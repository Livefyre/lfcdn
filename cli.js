#!/usr/bin/env node

// Figure out this package's name
// By looking in the package.json
var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var rename = require('gulp-rename');
var awspublish = require('gulp-awspublish');

var s3key = process.env.LF_CDN_S3_KEY;
var s3secret = process.env.LF_CDN_S3_SECRET;

var argv = require('minimist')(process.argv.slice(2));

function usage() {
    console.log('Usage: lfcdn {dev|qa|staging|prod}');
}

// -h help
if (argv.h) {
    usage();
    process.exit();
}

if ( ! (s3key && s3secret)) {
    console.log("Set LF_CDN_S3_KEY and LF_CDN_S3_SECRET");
    process.exit();
}

var packageJsonPath = path.join(process.cwd(), 'package.json');
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
var name = packageJson.name;
var version = packageJson.version;

if ( ! (name && version)) {
    console.log("Couldn't parse name and version from package.json");
    process.exit();
}

var env = argv._[0] || 'dev';
if (['dev', 'qa', 'staging', 'prod'].indexOf(env) === -1) {
    usage();
    process.exit();
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
    bucket: 'livefyre-cdn-dev'
});

var headers = { 
    'Cache-Control': 'max-age=315360000, no-transform, public'
};

var s3path = ['/libs', name, version].join('/');

gulp.src('./dist/*')
    .pipe(rename(function (path) {
        path.dirname += s3path;
    }))

     // gzip, Set Content-Encoding headers
    .pipe(awspublish.gzip()) 

    // publisher will add Content-Length, Content-Type and  headers specified above
    // If not specified it will set x-amz-acl to public-read by default
    .pipe(publisher.publish(headers))

    // create a cache file to speed up consecutive uploads
    .pipe(publisher.cache()) 

     // print upload updates to console 
    .pipe(awspublish.reporter());

