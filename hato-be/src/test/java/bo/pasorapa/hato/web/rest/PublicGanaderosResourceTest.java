package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;

import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PublicGanaderosResourceTest {

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> integrationDatabaseCleaner.clean());
    }

    @Test
    void shouldRegisterPublicGanaderoAndReturnJwt() {
        given()
                .contentType(ContentType.JSON)
                .header("X-Forwarded-For", "10.10.10.10")
                .body("""
                        {
                          "businessIdentifier": "12345678",
                          "name": "Ganadera Norte",
                          "email": "ganadera@hato.bo",
                          "password": "Ganadera9",
                          "website": "",
                          "formIssuedAt": "2026-05-02T22:59:55Z"
                        }
                        """)
                .when()
                .post("/api/public/ganaderos")
        .then()
                .statusCode(201)
                .body("accessToken", not(blankOrNullString()))
                .body("tokenType", equalTo("Bearer"))
                .body("expiresInSeconds", equalTo(28800))
                .body("user.username", equalTo("ganadera@hato.bo"))
                .body("user.role", equalTo("GANADERO"));
    }

    @Test
    void shouldRejectFilledHoneypotWithGenericMessage() {
        given()
                .contentType(ContentType.JSON)
                .header("X-Forwarded-For", "10.10.10.10")
                .body("""
                        {
                          "businessIdentifier": "12345678",
                          "name": "Ganadera Norte",
                          "email": "ganadera@hato.bo",
                          "password": "Ganadera9",
                          "website": "bot",
                          "formIssuedAt": "2026-05-02T22:59:55Z"
                        }
                        """)
                .when()
                .post("/api/public/ganaderos")
                .then()
                .statusCode(400)
                .body("message", equalTo("Error en el registro, intenta más tarde."));
    }

    @Test
    void shouldRejectFastSubmissionWithGenericMessage() {
        given()
                .contentType(ContentType.JSON)
                .header("X-Forwarded-For", "10.10.10.10")
                .body("""
                        {
                          "businessIdentifier": "12345678",
                          "name": "Ganadera Norte",
                          "email": "ganadera@hato.bo",
                          "password": "Ganadera9",
                          "website": "",
                          "formIssuedAt": "2999-05-02T22:59:59Z"
                        }
                        """)
                .when()
                .post("/api/public/ganaderos")
                .then()
                .statusCode(400)
                .body("message", equalTo("Error en el registro, intenta más tarde."));
    }

    @Test
    void shouldRejectInputsThatOverflowMirroredUserColumns() {
        given()
                .contentType(ContentType.JSON)
                .header("X-Forwarded-For", "10.10.10.10")
                .body("""
                        {
                          "businessIdentifier": "12345678",
                          "name": "Ganadera Norte",
                          "email": "campo-muy-largo-para-usuario-publico-001@registro-ganadero-pasorapa.bo",
                          "password": "Ganadera9",
                          "website": "",
                          "formIssuedAt": "2026-05-02T22:59:55Z"
                        }
                        """)
                .when()
                .post("/api/public/ganaderos")
                .then()
                .statusCode(400)
                .body("code", equalTo("REGISTRATION_EMAIL_TOO_LONG"))
                .body("message", equalTo("El correo supera el máximo permitido de 80 caracteres."));
    }
}
