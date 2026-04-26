import { Validators } from '@angular/forms';

export const PASSWORD_POLICY_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.';

export const passwordPolicyValidators = [
  Validators.required,
  Validators.minLength(8),
  Validators.pattern(PASSWORD_POLICY_PATTERN),
];
