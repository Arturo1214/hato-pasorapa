package bo.pasorapa.hato.service.dto.sync;

public record ConflictDiffField(
        String path,
        Object localValue,
        Object serverValue,
        String severity
) {
}
