package bo.pasorapa.hato.service.mapper;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

public final class AnimalImageSecuritySupport {

    public static final long V1_MAX_BYTES = 2L * 1024L * 1024L;
    public static final int V1_MAX_IMAGES_PER_ANIMAL_PER_SYNC = 3;
    public static final Set<String> DEFAULT_ALLOWLIST = Set.of("image/jpeg", "image/png");

    private AnimalImageSecuritySupport() {}

    public static String normalizeMime(String mimeType) {
        return mimeType == null ? null : mimeType.trim().toLowerCase();
    }

    public static String normalizeChecksum(String checksumSha256) {
        return checksumSha256 == null ? null : checksumSha256.trim().toLowerCase();
    }

    public static String sanitizeFileName(String fileName) {
        if (fileName == null) {
            return null;
        }

        String normalized = fileName.trim().replace('\\', '-').replace('/', '-');
        return normalized.replace("..", "-");
    }

    public static boolean isAllowedMime(String mimeType, Set<String> allowlist) {
        return mimeType != null && allowlist.contains(normalizeMime(mimeType));
    }

    public static String sha256Hex(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not compute image checksum.", exception);
        }
    }
}
