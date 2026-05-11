package bo.pasorapa.hato.service.dto.vetvisit;

import java.util.List;

public record VetVisitListResponse(List<VetVisitItemDto> items, int page, int size, long total) {
}
