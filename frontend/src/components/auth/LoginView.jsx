import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMail, IconLock, IconEye, IconEyeOff, IconBrandGithub, IconBrandGoogle, IconLoader2 } from '@tabler/icons-react';
import { AuthLayout } from './AuthLayout.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import styles from './LoginView.module.css';

export function LoginView() {
  const navigate = useNavigate();
  const { login, loginWithOAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      // Error handled by toast in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      await loginWithOAuth(provider);
    } catch {
      // Error handled in AuthContext
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to access your persistent research workspace and documents."
      footerText="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkHref="/signup"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="login-email">
            Email address
          </label>
          <div className={styles.inputWrapper}>
            <IconMail size={18} className={styles.inputIcon} />
            <input
              id="login-email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <div className={styles.inputWrapper}>
            <IconLock size={18} className={styles.inputIcon} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.togglePasswordBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <IconLoader2 size={18} className="animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        <div className={styles.divider}>
          <span>Or continue with</span>
        </div>

        <div className={styles.oauthGrid}>
          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => handleOAuth('google')}
          >
            <IconBrandGoogle size={18} />
            <span>Google</span>
          </button>
          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => handleOAuth('github')}
          >
            <IconBrandGithub size={18} />
            <span>GitHub</span>
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
