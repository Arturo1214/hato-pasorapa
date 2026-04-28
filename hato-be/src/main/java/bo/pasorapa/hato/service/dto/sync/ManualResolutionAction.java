package bo.pasorapa.hato.service.dto.sync;

public enum ManualResolutionAction {
    ACCEPT_SERVER,
    RETRY_LOCAL,
    DISCARD_LOCAL;

    public String apiValue() {
        return name().toLowerCase();
    }

    public static ManualResolutionAction fromApiValue(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            throw new IllegalArgumentException("SYNC_CONFLICT_ACTION_REQUIRED");
        }

        return switch (rawValue.trim().toLowerCase()) {
            case "accept_server" -> ACCEPT_SERVER;
            case "retry_local" -> RETRY_LOCAL;
            case "discard_local" -> DISCARD_LOCAL;
            default -> throw new IllegalArgumentException("SYNC_CONFLICT_ACTION_INVALID");
        };
    }
}
