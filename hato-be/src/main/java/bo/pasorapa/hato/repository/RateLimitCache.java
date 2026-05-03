package bo.pasorapa.hato.repository;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;

@ApplicationScoped
public class RateLimitCache {

    private static final int MAX_ATTEMPTS = 3;
    private final Cache<String, Integer> attempts;

    public RateLimitCache() {
        this(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(15))
                .maximumSize(10_000)
                .build());
    }

    public RateLimitCache(Cache<String, Integer> attempts) {
        this.attempts = attempts;
    }

    public boolean isLimitExceeded(String key) {
        return attempts.getIfPresent(normalize(key)) != null && attempts.getIfPresent(normalize(key)) >= MAX_ATTEMPTS;
    }

    public void recordAttempt(String key) {
        String normalizedKey = normalize(key);
        attempts.asMap().merge(normalizedKey, 1, Integer::sum);
    }

    private String normalize(String key) {
        return key == null || key.isBlank() ? "unknown" : key.trim().toLowerCase();
    }
}
