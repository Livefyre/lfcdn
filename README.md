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

    Usage: lfcdn {dev|qa|staging|prod}

## `lfcdn {dev|qa|staging|prod}`

Positional arg defaults to 'dev'.

    livefyre-cdn-dev: deploying streamhub-sdk
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.css
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.js
    [gulp] [cache]  libs/streamhub-sdk/2.7.5/streamhub-sdk.min.js.map
