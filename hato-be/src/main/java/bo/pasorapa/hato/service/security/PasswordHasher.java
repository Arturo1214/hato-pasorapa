package bo.pasorapa.hato.service.security;

import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.KeySpec;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

@ApplicationScoped
public class PasswordHasher {

    private static final int ITERATIONS = 65_536;
    private static final int KEY_LENGTH = 256;
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";

    public String hash(String rawPassword) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] hash = derive(rawPassword, salt);
        return ITERATIONS + ":" + Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(hash);
    }

    public boolean matches(String rawPassword, String storedHash) {
        String[] parts = storedHash.split(":");
        if (parts.length != 3) {
            return false;
        }
        byte[] salt = Base64.getDecoder().decode(parts[1].getBytes(StandardCharsets.UTF_8));
        byte[] expected = Base64.getDecoder().decode(parts[2].getBytes(StandardCharsets.UTF_8));
        byte[] actual = derive(rawPassword, salt);
        if (expected.length != actual.length) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < expected.length; i++) {
            diff |= expected[i] ^ actual[i];
        }
        return diff == 0;
    }

    private byte[] derive(String rawPassword, byte[] salt) {
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance(ALGORITHM);
            KeySpec spec = new PBEKeySpec(rawPassword.toCharArray(), salt, ITERATIONS, KEY_LENGTH);
            return factory.generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException exception) {
            throw new IllegalStateException("No se pudo generar hash de contraseña", exception);
        }
    }
}
