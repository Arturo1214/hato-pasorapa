package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.common.ActionMessageResponse;
import bo.pasorapa.hato.service.dto.admin.profile.ProfilePasswordUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.profile.ProfileResponse;
import bo.pasorapa.hato.service.dto.admin.profile.ProfileUpdateRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@ApplicationScoped
public class AdminProfileService {

    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;
    private final PasswordHasher passwordHasher;
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    public AdminProfileService(
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository,
            PasswordHasher passwordHasher,
            AuthService authService,
            ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.passwordHasher = passwordHasher;
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ProfileResponse updateProfile(UUID userId, ProfileUpdateRequest request) {
        User user = findUser(userId);
        Ganadero ganadero = findGanaderoForProfile(user);
        ContactInfoPayload contactInfo = new ContactInfoPayload(request.telefono().trim(), request.direccion().trim());

        ganadero.setContactInfo(writeContactInfo(contactInfo));
        ganaderoRepository.persist(ganadero);
        ganaderoRepository.flush();

        return new ProfileResponse(contactInfo.telefono(), contactInfo.direccion(), user.getRole().name());
    }

    @Transactional
    public ActionMessageResponse updatePassword(UUID userId, ProfilePasswordUpdateRequest request) {
        User user = findUser(userId);

        if (!passwordHasher.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException("CURRENT_PASSWORD_INVALID", "Contraseña actual incorrecta", Response.Status.BAD_REQUEST);
        }

        user.setPasswordHash(authService.hashPassword(request.newPassword()));
        userRepository.persist(user);
        userRepository.flush();

        return new ActionMessageResponse("Contraseña actualizada correctamente.");
    }

    private User findUser(UUID userId) {
        return userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario solicitado.", Response.Status.NOT_FOUND));
    }

    private Ganadero findGanaderoForProfile(User user) {
        if (user.getRole() != Role.GANADERO) {
            throw new BusinessException("PROFILE_NOT_AVAILABLE", "Este perfil no tiene datos de ganadero asociados.", Response.Status.NOT_FOUND);
        }

        return ganaderoRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new BusinessException("PROFILE_NOT_AVAILABLE", "Este perfil no tiene datos de ganadero asociados.", Response.Status.NOT_FOUND));
    }

    private String writeContactInfo(ContactInfoPayload contactInfo) {
        try {
            return objectMapper.writeValueAsString(contactInfo);
        } catch (JsonProcessingException exception) {
            throw new BusinessException("PROFILE_CONTACT_SERIALIZATION_ERROR", "No pudimos guardar la información de contacto.", Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private record ContactInfoPayload(String telefono, String direccion) {
    }
}
