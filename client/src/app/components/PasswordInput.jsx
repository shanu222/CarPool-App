import { useState } from "react";

export function PasswordInput({
  value,
  onChange,
  placeholder,
  required = false,
  className = "",
  inputClassName = "",
  name,
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        name={name}
        autoComplete={autoComplete}
        className={`w-full pr-12 ${inputClassName}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-md text-base transition-opacity duration-200 hover:opacity-80 cursor-pointer"
      >
        {showPassword ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default PasswordInput;
