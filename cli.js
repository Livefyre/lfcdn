#!/usr/bin/env node

// Figure out this package's name
// By looking in the package.json
var AWS = require('aws-sdk');
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

if ( ! (s3key && s3secret)) {
    console.log("Set LF_CDN_S3_KEY and LF_CDN_S3_SECRET");
    process.exit(1);
}

AWS.config = new AWS.Config({
    accessKeyId: s3key,
    secretAccessKey: s3secret,
    region: 'us-east-1'
});
var s3 = new AWS.S3();

var config = {};
var configPath = argv.c;
if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

var packageJsonPath = path.join(process.cwd(), 'package.json');
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
var name = 'streamhub-map' || packageJson.name;
var version = 'v1.2.1' || packageJson.version;

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

var packageSemver = semver(version);
if (!packageSemver.raw.indexOf('v') === 0) packageSemver.raw = 'v' + packageSemver.raw;

if ( ! config.dir) {
    // S3 doesn't like `+` in it's keys, so we'll convert
    // semvers with build fragments to /{version}/builds/{build}
    var s3path = ['/libs', name, packageSemver.version].join('/');
    if (packageSemver.build.length) {
        s3path += '/builds/' + packageSemver.build.join('.');
    }
    config.dir = s3path;
}

s3.listObjects({ Bucket: s3bucket } , function (err, data) {
    if (err) console.log(err) && process.exit(0);
    var contents = data.Contents;
    var exisiting;
    var pathFan = {};

    function createPathFan(path) {
        var deployedVersion;
        var nameIndex;
        var versionIndex;

        nameIndex = path.indexOf(name)
        if (nameIndex > -1) {
            exisiting = true;
            // assuming that the version follows the name, conventionally enforced.
            versionIndex = [nameIndex + 1]
            deployedVersion = path[versionIndex]
            if (!semver.valid(deployedVersion)) return;
            deployedVersion = semver(deployedVersion);

            // a little verbose, checking to see what versions we should deploy and building the version strings.
            if (packageSemver.major >= deployedVersion.major) {
                pathFan.major = path.slice(0, -1);
                pathFan.major[versionIndex] = packageSemver.raw.split('.')[0];
                pathFan.major = pathFan.major.join('/');
            }

            if ((packageSemver.major === deployedVersion.major) && packageSemver.minor >= deployedVersion.minor) {
                pathFan.minor = path.slice(0, -1);
                pathFan.minor[versionIndex] = packageSemver.raw.split('.').slice(0, -1).join('.');
                pathFan.minor = pathFan.minor.join('/');
            }

            if ((packageSemver.major === deployedVersion.major) && (packageSemver.minor === deployedVersion.minor) && packageSemver.patch >= deployedVersion.patch) {
                pathFan.patch = path.slice(0, -1);
                pathFan.patch[versionIndex] = packageSemver.raw;
                pathFan.patch = pathFan.patch.join('/');
            }
        }
    }

    for (var i = contents.length - 1; i >= 0; i--) {
        createPathFan(contents[i].Key.split('/'));
    }

    if (!exisiting) {
        console.log('no exisiting versions found in deployment');
        createPathFan(config.dir.split('/'));
    }

    deployPaths(pathFan);
});

var headers = {
    'Cache-Control': 'max-age=315360000, no-transform, public'
};

var publisher = awspublish.create({
    key: s3key,
    secret: s3secret,
    bucket: s3bucket
});

function deployPaths(pathFan) {
    var versions = Object.keys(pathFan);
    console.log(pathFan);

    versions.forEach(function(val, i) {
        var s3path = pathFan[versions[i]];
        gulp.src('./dist/*')
            .pipe(rename(function (path) {
                path = [s3path, path.dirname, path.basename + path.extname].join('/');
                // mrr
                // libs/apps/cheung31/streamhub-map/v1.2/./test.css
                console.log(path)
            }))

             // gzip, Set Content-Encoding headers
            // .pipe(awspublish.gzip())

            // // publisher will add Content-Length, Content-Type and  headers specified above
            // // If not specified it will set x-amz-acl to public-read by default
            // .pipe(publisher.publish(headers))

            //  // print upload updates to console
            // .pipe(awspublish.reporter());
    });
}


console.log("config:", config);
console.log(s3bucket+": deploying "+name);
