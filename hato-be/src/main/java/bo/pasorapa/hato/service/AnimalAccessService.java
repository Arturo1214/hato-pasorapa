package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@ApplicationScoped
public class AnimalAccessService {

    private final AnimalRepository animalRepository;
    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;

    public AnimalAccessService(
            AnimalRepository animalRepository,
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository) {
        this.animalRepository = animalRepository;
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
    }

    public Animal requireAccessibleAnimal(UUID animalUuid, UUID currentUserId) {
        Animal animal = animalRepository.findByUuid(animalUuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));
        requireAccessibleAnimal(animal, currentUserId);
        return animal;
    }

    public void requireAccessibleAnimal(Animal animal, UUID currentUserId) {
        UUID allowedGanaderoId = resolveAllowedGanaderoId(currentUserId);
        if (allowedGanaderoId == null) {
            return;
        }

        if (animal.getOwnerGanadero() == null || !allowedGanaderoId.equals(animal.getOwnerGanadero().getId())) {
            throw new BusinessException(
                    "ANIMAL_OWNER_FORBIDDEN",
                    "El ganadero autenticado no puede consultar animales de otro propietario.",
                    Response.Status.FORBIDDEN);
        }
    }

    public UUID resolveAllowedGanaderoId(UUID currentUserId) {
        if (currentUserId == null) {
            return null;
        }

        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));

        if (currentUser.getRole() == Role.ADMIN) {
            return null;
        }

        if (currentUser.getRole() == Role.GANADERO) {
            return ganaderoRepository.findByEmail(currentUser.getEmail())
                    .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                    .getId();
        }

        throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no puede consultar animales.", Response.Status.FORBIDDEN);
    }
}
