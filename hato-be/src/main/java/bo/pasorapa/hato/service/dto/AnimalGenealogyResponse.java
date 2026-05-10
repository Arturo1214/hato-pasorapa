package bo.pasorapa.hato.service.dto;

import java.util.List;

public record AnimalGenealogyResponse(
        AnimalResponse animal,
        AnimalResponse mother,
        AnimalResponse father,
        List<AnimalResponse> offspring
) {
}
