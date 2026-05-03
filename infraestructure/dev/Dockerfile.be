FROM quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21 AS build

WORKDIR /project

COPY hato-be/.mvn/ .mvn/
COPY --chmod=0755 hato-be/mvnw hato-be/pom.xml ./

RUN ./mvnw -B -DskipTests dependency:go-offline

COPY --chown=1001:0 hato-be/ ./

RUN chmod 0644 src/main/resources/keys/*.pem && rm -rf target

RUN ./mvnw -B -DskipTests -Dnative package

FROM registry.access.redhat.com/ubi9/ubi-minimal:9.6

WORKDIR /work/

COPY --from=build /project/target/*-runner /work/application

EXPOSE 8080

ENTRYPOINT ["./application", "-Dquarkus.http.host=0.0.0.0"]
