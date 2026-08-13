package bo.pasorapa.hato.service.dto;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.List;

@RegisterForReflection
public record AnimalGenealogyResponse(
        AnimalResponse animal,
        AnimalResponse mother,
        AnimalResponse father,
        List<AnimalResponse> offspring,
        AnimalGenealogyNode ancestors
) {
    @RegisterForReflection
    public record AnimalGenealogyNode(
            AnimalResponse animal,
            AnimalGenealogyNode mother,
            AnimalGenealogyNode father
    ) {}
}
