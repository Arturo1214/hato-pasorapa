package bo.pasorapa.hato.service.validator;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.repository.RateLimitCache;
import bo.pasorapa.hato.service.error.AntiSpamException;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AntiSpamValidatorTest {

    @Test
    void shouldRejectFilledHoneypot() {
        AntiSpamValidator validator = buildValidator();

        AntiSpamException exception = assertThrows(AntiSpamException.class,
                () -> validator.validate("bot-field", Instant.parse("2026-05-02T22:59:56Z"), "127.0.0.1", "ganadero@hato.bo"));

        assertEquals("ANTI_SPAM_REJECTED", exception.code());
    }

    @Test
    void shouldRejectFastSubmission() {
        AntiSpamValidator validator = buildValidator();

        AntiSpamException exception = assertThrows(AntiSpamException.class,
                () -> validator.validate("", Instant.parse("2026-05-02T22:59:59Z"), "127.0.0.1", "ganadero@hato.bo"));

        assertEquals("ANTI_SPAM_REJECTED", exception.code());
    }

    @Test
    void shouldRejectRateLimitExceeded() {
        AntiSpamValidator validator = buildValidator();
        Instant issuedAt = Instant.parse("2026-05-02T22:59:56Z");

        assertDoesNotThrow(() -> validator.validate("", issuedAt, "127.0.0.1", "ganadero@hato.bo"));
        assertDoesNotThrow(() -> validator.validate("", issuedAt, "127.0.0.1", "ganadero@hato.bo"));
        assertDoesNotThrow(() -> validator.validate("", issuedAt, "127.0.0.1", "ganadero@hato.bo"));

        AntiSpamException exception = assertThrows(AntiSpamException.class,
                () -> validator.validate("", issuedAt, "127.0.0.1", "ganadero@hato.bo"));

        assertEquals("ANTI_SPAM_RATE_LIMITED", exception.code());
    }

    private AntiSpamValidator buildValidator() {
        RateLimitCache cache = new RateLimitCache(Caffeine.newBuilder().maximumSize(50).build());
        Clock clock = Clock.fixed(Instant.parse("2026-05-02T23:00:00Z"), ZoneOffset.UTC);
        return new AntiSpamValidator(cache, clock);
    }
}
