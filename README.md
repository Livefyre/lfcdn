# lfcdn

Deploy your `./dist/` directory to the Livefyre CDN.

It will read from the `name` and `version` in your package.json

You will need to set the following environment variables

    export LF_CDN_S3_KEY='...'
    export LF_CDN_S3_SECRET='...'

Install with npm.

    npm install -g git+ssh://git@github.com:Livefyre/lfcdn

Note the `-g`. It will add `lfcdn` to your PATH.

## `lfcdn -h`

    Usage: lfcdn -e {dev|qa|staging|prod} -c [/path/to/config.json]

## `lfcdn -c [/path/to/config.json]`

Load config from a JSON config file. Supported config options:

* `dir` - S3 key to deploy files to. Defaults to a path derrived from the `name` in `package.json`

## `lfcdn -e {dev|qa|staging|prod}`

Environment to deploy to. Defaults to `dev`.

## `lfcdn --scope {major|minor|patch}`

By default the project will be deployed to three locations, for a major, minor, and patch distribution.
If you want to deploy only one version withoug affecting the others, this is possible with the `scope`
option.

## output

    livefyre-cdn-dev: deploying streamhub-sdk
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.css
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.js
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.js.map
