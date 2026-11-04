# Optional GIS extension to the *already built* isolated science image.
# Build: docker build -f publishing/Dockerfile.science -t bc-book-science:ci .
#        docker build -f publishing/Dockerfile.geo -t bc-book-geo:ci .
ARG SCIENCE_IMAGE=bc-book-science:ci
FROM ${SCIENCE_IMAGE}
USER root
COPY publishing/requirements-geo.txt /opt/bc/publishing/requirements-geo.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r /opt/bc/publishing/requirements-geo.txt
USER 10002:10002
ENTRYPOINT ["python", "-m", "publishing.scientific_assets"]
