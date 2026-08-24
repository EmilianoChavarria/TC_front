import { AbstractControl } from '@angular/forms';

import { ValidationErrors as ApiValidationErrors } from '../../core/models/api.models';

const MESSAGES: Record<string, (error: unknown) => string> = {
  required: () => 'Este campo es obligatorio',
  email: () => 'Escriba un correo electrónico válido',
  minlength: (error) =>
    `Debe tener al menos ${(error as { requiredLength: number }).requiredLength} caracteres`,
  maxlength: (error) =>
    `No debe exceder ${(error as { requiredLength: number }).requiredLength} caracteres`,
  mismatch: () => 'Las contraseñas no coinciden',
  sameAsCurrent: () => 'La nueva contraseña debe ser distinta de la actual',
  requirements: (error) => (error as { message: string }).message,
};

/** Primer mensaje del control, sólo cuando ya fue tocado o enviado. */
export function controlError(control: AbstractControl | null, submitted = false): string | null {
  if (!control || !control.errors || (!control.touched && !submitted)) {
    return null;
  }

  const [key, value] = Object.entries(control.errors)[0];

  return MESSAGES[key]?.(value) ?? 'Valor no válido';
}

/**
 * Traslada los errores 422 del backend a los controles del formulario. Los
 * campos que no existen en el formulario se devuelven para mostrarlos aparte.
 */
export function applyServerErrors(
  form: { get(path: string): AbstractControl | null },
  errors: ApiValidationErrors | null,
): string[] {
  const unmatched: string[] = [];

  Object.entries(errors ?? {}).forEach(([field, messages]) => {
    const control = form.get(field);
    const message = messages[0];

    if (control) {
      control.setErrors({ ...(control.errors ?? {}), requirements: { message } });
      control.markAsTouched();
      return;
    }

    unmatched.push(...messages);
  });

  return unmatched;
}
