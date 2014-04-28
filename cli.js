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

var versionScope = null;
if (argv.scope) {
    versionScope = argv.scope;
}

if ( ! (s3key && s3secret)) {
    console.log("Set LF_CDN_S3_KEY and LF_CDN_S3_SECRET");
    process.exit(1);
}

var config = {};
var configPath = argv.c;
if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

var packageJsonPath = path.join(process.cwd(), 'package.json');
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
var name = packageJson.name;
var version = packageJson.version;

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

if ( ! semver.valid(version)) {
    console.log("Invalid semver version");
    process.exit(1);
}

var packageSemver = semver(version);
var versionString = packageSemver.raw;
if (versionString.indexOf('v') !== 0) versionString = 'v' + versionString;

if ( ! config.dir) {
    (function () {
        // S3 doesn't like `+` in it's keys, so we'll convert
        // semvers with build fragments to /{version}/builds/{build}
        var s3path = ['/libs', name, packageSemver.version].join('/');
        if (packageSemver.build.length) {
            s3path += '/builds/' + packageSemver.build.join('.');
            versionString = versionString.slice(0, versionString.indexOf('+'));
        }
        config.dir = s3path;
    })();
}

var pathKeys = ['major', 'minor', 'patch'];
var pathFan = {};
for (var i = 0; i < pathKeys.length; i++) {
    pathFan[pathKeys[i]] = '';
}

/**
 * Ensure that the dist is deployed as a major, minor, and patch version.
 * e.g., v1/stuff, v1.0/stuff, and v1.0.0/stuff
 * @param {string} configPath
 */
function ensureFullFan(configPath) {
    console.log("path:", configPath);
    pathKeys.forEach(function(val, i) {
        addVersionPath(val, i, configPath.split('/'));
    });
}

/**
 * Add each verion scope to the paths that will be deployed.
 * If the --scope option has been provided, only the specified scope will be provided
 * @param {string} version The scope e.g. 'major'
 * @param {number} keyIndex The index of the scope e.g. 'major' === 0
 * @param {Array} basePath The base s3 path that the version scope will be added to. e.g. /project/<version>/stuff
 */
function addVersionPath(version, keyIndex, basePath) {
    var s3path = basePath.slice(0);
    if (versionScope && version !== versionScope) return;
    s3path[basePath.indexOf(name) + 1] = versionString.split('.').slice(0, keyIndex + 1).join('.');
    pathFan[version] = s3path;
}

var headers = {
    'Cache-Control': 'max-age=315360000, no-transform, public'
};

var publisher = awspublish.create({
    key: s3key,
    secret: s3secret,
    bucket: s3bucket
});

// Push the dist to s3
function deployPaths(pathFan) {
    console.log(s3bucket+": deploying "+name);
    Object.keys(pathFan).forEach(function(val, i) {
        var s3path = pathFan[val];
        if (!s3path) return;
        gulp.src('./dist/*')
            .pipe(rename(function (path) {
                path.dirname += s3path.join('/');
            }))

             // gzip, Set Content-Encoding headers
            .pipe(awspublish.gzip())

            // publisher will add Content-Length, Content-Type and  headers specified above
            // If not specified it will set x-amz-acl to public-read by default
            .pipe(publisher.publish(headers))

             // print upload updates to console
             // TODO: full public url
            .pipe(awspublish.reporter());
    });
}

ensureFullFan(config.dir);
deployPaths(pathFan);
