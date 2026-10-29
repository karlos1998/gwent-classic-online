package com.gwentonline.player;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Reports the specific {@link NicknamePolicy} error code as the violation message. */
public class NicknameConstraintValidator implements ConstraintValidator<ValidNickname, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return NicknamePolicy.check(value)
                .map(code -> {
                    context.disableDefaultConstraintViolation();
                    context.buildConstraintViolationWithTemplate(code).addConstraintViolation();
                    return false;
                })
                .orElse(true);
    }
}
