import React, { useState } from "react";
import MemphisBackground from "@/components/MemphisBackground";
import { MessageCircle, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Mode = "login" | "register";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loading = isLoggingIn || isRegistering;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (name.trim().length < 1) {
          toast.error("이름을 입력해주세요");
          return;
        }
        if (password.length < 6) {
          toast.error("비밀번호는 최소 6자 이상이어야 합니다");
          return;
        }
        await register(email, password, name);
        toast.success("환영합니다! 🎉");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다";
      toast.error(msg);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setPassword("");
  };

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        height: "100dvh",
        width: "100%",
        background: "var(--bg)",
      }}
    >
      <MemphisBackground />

      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 memphis-btn"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--bg-elevated)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="테마 전환"
        type="button"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex flex-col items-center text-center animate-bounce-in"
        style={{
          background: "var(--bg-elevated)",
          color: "var(--fg)",
          border: "2.5px solid var(--border)",
          borderRadius: "1.75rem",
          boxShadow: "6px 6px 0 var(--border)",
          padding: "2.25rem 1.75rem",
          maxWidth: 400,
          width: "calc(100% - 2rem)",
          margin: "0 1rem",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "26%",
            background: "var(--yellow)",
            border: "2.5px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.875rem",
            boxShadow: "4px 4px 0 var(--border)",
            color: "var(--ink)",
          }}
        >
          <MessageCircle size={30} strokeWidth={2.5} />
        </div>

        <h1
          className="font-display"
          style={{ fontSize: "2.1rem", lineHeight: 1, marginBottom: "0.2rem" }}
        >
          AURA
        </h1>
        <p
          style={{
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </p>

        <div
          style={{
            height: 4,
            width: 72,
            background: "linear-gradient(90deg, var(--mint), var(--lilac), var(--yellow))",
            borderRadius: 3,
            border: "1.5px solid var(--border)",
            marginBottom: "1.25rem",
          }}
        />

        {/* Name (register only) */}
        {mode === "register" && (
          <div className="w-full mb-2.5 relative">
            <User
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--fg-muted)" }}
            />
            <input
              type="text"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="memphis-input w-full pl-10 pr-3 py-2.5 text-sm"
              autoComplete="name"
            />
          </div>
        )}

        {/* Email */}
        <div className="w-full mb-2.5 relative">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="memphis-input w-full pl-10 pr-3 py-2.5 text-sm"
            autoComplete={mode === "login" ? "email" : "email"}
          />
        </div>

        {/* Password */}
        <div className="w-full mb-3 relative">
          <Lock
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--fg-muted)" }}
          />
          <input
            type={showPassword ? "text" : "password"}
            placeholder={mode === "register" ? "비밀번호 (6자 이상)" : "비밀번호"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 6 : undefined}
            className="memphis-input w-full pl-10 pr-10 py-2.5 text-sm"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{
              background: "transparent",
              border: 0,
              padding: 6,
              cursor: "pointer",
              color: "var(--fg-muted)",
              display: "flex",
            }}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="memphis-btn w-full py-3 font-bold mb-2.5"
          style={{
            background: loading ? "var(--gray-300)" : "var(--ink)",
            color: "var(--white)",
            borderRadius: "0.875rem",
            fontSize: "0.95rem",
            letterSpacing: "0.02em",
          }}
        >
          {loading ? "잠시만요..." : mode === "login" ? "로그인 →" : "가입하기 →"}
        </button>

        {/* Mode switch */}
        <button
          type="button"
          onClick={switchMode}
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontSize: "0.8rem",
            color: "var(--fg-soft)",
            fontFamily: "inherit",
            padding: "0.25rem 0.5rem",
          }}
        >
          {mode === "login" ? (
            <>아직 계정이 없으신가요? <span style={{ color: "var(--fg)", fontWeight: 700 }}>가입하기</span></>
          ) : (
            <>이미 계정이 있으신가요? <span style={{ color: "var(--fg)", fontWeight: 700 }}>로그인</span></>
          )}
        </button>
      </form>
    </div>
  );
}
