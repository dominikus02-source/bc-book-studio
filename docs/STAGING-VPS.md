# BC Book Studio staging on a VPS

Use a dedicated staging project and PostgreSQL volume. The web service binds to localhost and PostgreSQL and Quarto stay on Docker networks. Use an authorized reverse proxy for team HTTPS access.

## Build workers from the release source

Check out the verified release commit. Set STAGING_SOURCE_SHA to that commit, STAGING_EXPORT_IMAGE to a staging-only local image name, and STAGING_QUARTO_IMAGE to a different staging-only local image name. Configure the remaining required values from compose.staging.yml in a private environment file. Set the web and migrator image references to the verified release digests. Create the artifact directory on the host with permissions for the non-root UID used by the image. Use a URL-safe random database password and a distinct Quarto token of at least 32 characters.

The renderer build targets Linux amd64 and downloads Quarto 1.9.36 with a pinned SHA-256. The export worker and web share the staging artifact directory.

From the release checkout:

    docker compose --env-file /path/to/staging.env -f compose.staging.yml -f compose.staging-build.yml config --quiet
    docker compose --env-file /path/to/staging.env -f compose.staging.yml -f compose.staging-build.yml build export-worker quarto
    docker compose --env-file /path/to/staging.env -f compose.staging.yml --profile migration run --rm migrate migrate deploy
    docker compose --env-file /path/to/staging.env -f compose.staging.yml up -d

Verify the HTTPS endpoint, an authenticated session, and an export that runs through Quarto and can be downloaded by the web service. Record the source SHA and image digests before promotion. Preserve the database volume and rehearse restore before the production change.
