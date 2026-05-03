package bo.pasorapa.hato.service.error;

import jakarta.ws.rs.core.Response;

public class AntiSpamException extends BusinessException {

    private final Long retryAfterSeconds;

    public AntiSpamException(String code, Response.Status status) {
        this(code, status, null);
    }

    public AntiSpamException(String code, Response.Status status, Long retryAfterSeconds) {
        super(code, "Error en el registro, intenta más tarde.", status);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public Long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
