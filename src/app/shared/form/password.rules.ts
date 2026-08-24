import { PasswordRequirements } from '../../core/models/auth.models';

export interface PasswordRule {
  label: string;
  met: boolean;
}

/**
 * Traduce los requisitos configurados por el administrador a una lista
 * verificable en vivo. La validación definitiva la hace el backend; esto evita
 * que el usuario descubra los errores hasta enviar.
 */
export function passwordRules(
  value: string,
  requirements: PasswordRequirements | null,
): PasswordRule[] {
  if (!requirements) {
    return [];
  }

  const rules: PasswordRule[] = [
    {
      label: `Al menos ${requirements.minLength} caracteres`,
      met: value.length >= requirements.minLength,
    },
  ];

  if (requirements.requireUppercase) {
    rules.push({ label: 'Una letra mayúscula', met: /\p{Lu}/u.test(value) });
  }

  if (requirements.requireLowercase) {
    rules.push({ label: 'Una letra minúscula', met: /\p{Ll}/u.test(value) });
  }

  if (requirements.requireNumbers) {
    rules.push({ label: 'Un número', met: /\d/.test(value) });
  }

  if (requirements.requireSpecialChars) {
    const allowed = requirements.allowedSpecialChars ?? '';
    const met = allowed !== '' && value.split('').some((char) => allowed.includes(char));

    rules.push({ label: `Un carácter especial (${allowed})`, met });
  }

  return rules;
}

export function allRulesMet(rules: PasswordRule[]): boolean {
  return rules.length > 0 && rules.every((rule) => rule.met);
}
