package com.gwentonline.player;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Bean Validation constraint for {@link NicknamePolicy}. */
@Documented
@Constraint(validatedBy = NicknameConstraintValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidNickname {

    String message() default "nickname.invalid";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
