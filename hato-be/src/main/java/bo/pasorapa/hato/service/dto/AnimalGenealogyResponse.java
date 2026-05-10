package bo.pasorapa.hato.service.dto;

import java.util.List;

public record AnimalGenealogyResponse(
        AnimalResponse animal,
        AnimalResponse mother,
        AnimalResponse father,
        List<AnimalResponse> offspring,
        AnimalGenealogyNode ancestors
) {
    public record AnimalGenealogyNode(
            AnimalResponse animal,
            AnimalGenealogyNode mother,
            AnimalGenealogyNode father
    ) {}
}
