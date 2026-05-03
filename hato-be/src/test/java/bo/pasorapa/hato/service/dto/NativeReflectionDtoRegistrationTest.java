package bo.pasorapa.hato.service.dto;

import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.admin.auth.AuthUserResponse;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicCreateRequest;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicResponse;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.PublicUserDto;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.util.List;
import org.junit.jupiter.api.Test;

class NativeReflectionDtoRegistrationTest {

    @Test
    void shouldRegisterPublicAndAuthDtosForNativeReflection() {
        List<Class<?>> dtoClasses = List.of(
                GanaderoPublicCreateRequest.class,
                GanaderoPublicResponse.class,
                PublicUserDto.class,
                AuthLoginRequest.class,
                AuthLoginResponse.class,
                AuthUserResponse.class);

        for (Class<?> dtoClass : dtoClasses) {
            assertTrue(dtoClass.isAnnotationPresent(RegisterForReflection.class),
                    () -> dtoClass.getSimpleName() + " must be registered for native reflection");
        }
    }
}
