package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import bo.pasorapa.hato.service.dto.admin.bootstrap.AdminBootstrapRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserCreateRequest;
import bo.pasorapa.hato.service.dto.admin.users.AdminUserPasswordUpdateRequest;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

class AdminPasswordPolicyAnnotationsTest {

    @Test
    void shouldExposePasswordPolicyAnnotationsForAdminDtos() {
        assertPasswordPolicy(AdminBootstrapRequest.class);
        assertPasswordPolicy(AdminUserCreateRequest.class);
        assertPasswordPolicy(AdminUserPasswordUpdateRequest.class);
    }

    private void assertPasswordPolicy(Class<?> dtoClass) {
        Method passwordAccessor;
        try {
            passwordAccessor = dtoClass.getDeclaredMethod("password");
        } catch (NoSuchMethodException exception) {
            throw new AssertionError(exception);
        }

        Size size = passwordAccessor.getAnnotation(Size.class);
        Pattern pattern = passwordAccessor.getAnnotation(Pattern.class);

        assertNotNull(size);
        assertEquals(8, size.min());
        assertNotNull(pattern);
        assertEquals(AuthService.PASSWORD_POLICY_REGEX, pattern.regexp());
        assertEquals(AuthService.PASSWORD_POLICY_MESSAGE, pattern.message());
    }
}
