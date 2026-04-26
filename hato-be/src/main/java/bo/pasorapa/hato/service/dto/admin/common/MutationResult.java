package bo.pasorapa.hato.service.dto.admin.common;

public record MutationResult<T>(T data, boolean replayed) {
}
