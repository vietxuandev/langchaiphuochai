import { Field, InputType } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';

/** Input đăng nhập (validate bằng zod ở tầng resolver). */
@InputType('LoginInput')
export class LoginInputType {
  @Field(() => String)
  email!: string;

  @Field(() => String)
  password!: string;
}

@InputType('RegisterInput')
export class RegisterInputType {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  password!: string;

  @Field(() => String)
  confirmPassword!: string;
}

@InputType('UpdateProfileInput')
export class UpdateProfileInputType {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}

@InputType('ChangePasswordInput')
export class ChangePasswordInputType {
  @Field(() => String)
  currentPassword!: string;

  @Field(() => String)
  newPassword!: string;

  @Field(() => String)
  confirmPassword!: string;
}

@InputType('AdminCreateUserInput')
export class AdminCreateUserInputType {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  password!: string;

  @Field(() => Role)
  role!: Role;
}

@InputType('UpdateUserInput')
export class UpdateUserInputType {
  @Field(() => String)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Role, { nullable: true })
  role?: Role;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
