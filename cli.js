#!/usr/bin/env node

// Figure out this package's name
// By looking in the package.json
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var gulp = require('gulp');
var rename = require('gulp-rename');
var awspublish = require('gulp-awspublish');

var s3key = process.env.LF_CDN_S3_KEY;
var s3secret = process.env.LF_CDN_S3_SECRET;

var argv = require('minimist')(process.argv.slice(2));

function usage() {
    console.error('Usage: lfcdn -e {dev|qa|staging|prod} -c [/path/to/config.json] [--urls]');
}

// -h help
if (argv.h) {
    usage();
    process.exit();
}

var maxage = '315360000';
var build = false;

if ( ! (s3key && s3secret)) {
    console.error("Set LF_CDN_S3_KEY and LF_CDN_S3_SECRET");
    process.exit(1);
}

var config = {};
var configPath = argv.c;
if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

if (argv.maxage || config.maxage) {
    maxage = argv.maxage || config.maxage;
}

var createOnly =  false;
if (argv.co || argv.createOnly) {
    createOnly = true;
}

var packageJsonPath = path.join(process.cwd(), 'package.json');
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
var name = packageJson.name;
var version = argv.version || packageJson.version;

if (argv.build || config.build) {
    build = (argv.build || config.build) + '';
    if (build.indexOf('+') !== 0) {
        build = '+' + build;
    }
    version += build;
}

if (argv.name || config.name) {
    name = argv.name || config.name;
}

if ( ! (name && version)) {
    console.error("Couldn't parse name and version from package.json");
    process.exit(1);
}

var env = argv.e || 'dev';
if (['dev', 'qa', 'staging', 'prod'].indexOf(env) === -1) {
    usage();
    process.exit(1);
}

var PROD_BUCKET = 'livefyre-cdn'
if (env === 'prod') {
    s3bucket = PROD_BUCKET;
} else {
    s3bucket = 'livefyre-cdn-'+env;
}

var publisher = awspublish.create({
    accessKeyId: s3key,
    secretAccessKey: s3secret,
    params: {
      Bucket: s3bucket
    }
});

var headers = {
    'Cache-Control': 'max-age={{maxage}}, no-transform, public'.replace('{{maxage}}', maxage)
};

if ( ! config.dir) {
    // S3 doesn't like `+` in it's keys, so we'll convert
    // semvers with build fragments to /{version}/builds/{build}
    var packageSemver = semver(version);
    var s3path = ['/libs', name, 'v' + packageSemver.version].join('/');
    if (packageSemver.build.length) {
        s3path += '/builds/' + packageSemver.build.join('.');
    }
    config.dir = s3path;
}

function logError(e) {
    console.log(e.message);
}

function s3Url(bucket, path) {
    var protocol = 'https://';
    var host;
    if (bucket === PROD_BUCKET) {
      host = 'cdn.livefyre.com/'
    } else {
      host = [bucket, '.s3.amazonaws.com/'].join('');
    }
    var url = [protocol, host, path].join('');
    return url;
}

// --urls opts into a reporter that prints file URLs to stdout
var reporter
switch (argv.reporter) {
    case 'urls':
        reporter = require('./reporter')({
          states: ['create', 'update', 'delete', 'skip'],
          eachFile: function (file) {
            var url = s3Url(s3bucket, file.s3.path)
            console.log(url);
          }
        })
        break;
    case 'none':
        reporter = require('./reporter')({});
        break;
    default:
        reporter = awspublish.reporter();

}

gulp.src('./dist/**/*')
    .on('error', logError)

    .pipe(rename(function (path) {
        path.dirname = config.dir + '/' + path.dirname;
    }))
    .on('error', logError)

     // gzip, Set Content-Encoding headers
    .pipe(awspublish.gzip())
    .on('error', logError)

    // publisher will add Content-Length, Content-Type and  headers specified above
    // If not specified it will set x-amz-acl to public-read by default
    .pipe(publisher.publish(headers, { createOnly: createOnly }))
    .on('error', logError)

     // print upload updates to console
    .pipe(reporter)
    .on('error', logError);

// JJ: I am really sorry about this, but there is a rogue TCP error and I don't care where it is
process.on('uncaughtException', logError);
