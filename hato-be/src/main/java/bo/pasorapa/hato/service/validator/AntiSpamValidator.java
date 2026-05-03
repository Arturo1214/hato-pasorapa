package bo.pasorapa.hato.service.validator;

import bo.pasorapa.hato.repository.RateLimitCache;
import bo.pasorapa.hato.service.error.AntiSpamException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@ApplicationScoped
public class AntiSpamValidator {

    static final long MINIMUM_SECONDS = 3L;
    private final RateLimitCache rateLimitCache;
    private final Clock clock;

    @Inject
    public AntiSpamValidator(RateLimitCache rateLimitCache) {
        this(rateLimitCache, Clock.systemUTC());
    }

    AntiSpamValidator(RateLimitCache rateLimitCache, Clock clock) {
        this.rateLimitCache = rateLimitCache;
        this.clock = clock;
    }

    public void validate(String website, Instant formIssuedAt, String ip, String email) {
        if (website != null && !website.isBlank()) {
            throw new AntiSpamException("ANTI_SPAM_REJECTED", Response.Status.BAD_REQUEST);
        }

        if (formIssuedAt == null || Duration.between(formIssuedAt, clock.instant()).getSeconds() < MINIMUM_SECONDS) {
            throw new AntiSpamException("ANTI_SPAM_REJECTED", Response.Status.BAD_REQUEST);
        }

        if (rateLimitCache.isLimitExceeded("ip:" + ip) || rateLimitCache.isLimitExceeded("email:" + email)) {
            throw new AntiSpamException("ANTI_SPAM_RATE_LIMITED", Response.Status.TOO_MANY_REQUESTS, Duration.ofMinutes(15).toSeconds());
        }

        rateLimitCache.recordAttempt("ip:" + ip);
        rateLimitCache.recordAttempt("email:" + email);
    }
}
