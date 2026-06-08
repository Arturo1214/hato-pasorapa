package bo.pasorapa.hato.service.dto.vetvisit;

public final class VetVisitStatusNormalizer {

    private VetVisitStatusNormalizer() {}

    public static String canonicalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim().toUpperCase();
        return switch (normalized) {
            case "PROGRAMADA", "SCHEDULED", "PENDING" -> "PENDING";
            case "ATENDIDA", "ATTENDED" -> "ATTENDED";
            case "CANCELADA", "CANCELLED", "CANCELED" -> "CANCELED";
            case "REPROGRAMADA", "RESCHEDULED" -> "RESCHEDULED";
            case "FINALIZADA", "FINALIZED" -> "FINALIZED";
            default -> normalized;
        };
    }
}
