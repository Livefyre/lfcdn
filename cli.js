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
    console.log('Usage: lfcdn -e {dev|qa|staging|prod} -c [/path/to/config.json]');
}

// -h help
if (argv.h) {
    usage();
    process.exit();
}

var maxage = '315360000';
var build = false;

if ( ! (s3key && s3secret)) {
    console.log("Set LF_CDN_S3_KEY and LF_CDN_S3_SECRET");
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


var packageJsonPath = path.join(process.cwd(), 'package.json');
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
var name = packageJson.name;
var version = packageJson.version;

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
    console.log("Couldn't parse name and version from package.json");
    process.exit(1);
}

var env = argv.e || 'dev';
if (['dev', 'qa', 'staging', 'prod'].indexOf(env) === -1) {
    usage();
    process.exit(1);
}

if (env === 'prod') {
    s3bucket = 'livefyre-cdn'
} else {
    s3bucket = 'livefyre-cdn-'+env;
}

console.log(s3bucket+": deploying "+name);

var publisher = awspublish.create({
    key: s3key,
    secret: s3secret,
    bucket: s3bucket
});

var headers = {
    'Cache-Control': 'max-age={{maxage}}, no-transform, public'.replace('{{maxage}}', maxage)
};

console.log('config:', config);
console.log('headers:', headers);

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
    .pipe(publisher.publish(headers))
    .on('error', logError)

     // print upload updates to console
    .pipe(awspublish.reporter())
    .on('error', logError);

// JJ: I am really sorry about this, but there is a rogue TCP error and I don't care where it is
process.on('uncaughtException', logError);
