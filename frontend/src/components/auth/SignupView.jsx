import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconUser, IconMail, IconLock, IconEye, IconEyeOff, IconBrandGithub, IconBrandGoogle, IconLoader2 } from '@tabler/icons-react';
import { AuthLayout } from './AuthLayout.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import styles from './LoginView.module.css';

export function SignupView() {
  const navigate = useNavigate();
  const { signup, loginWithOAuth } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await signup(email, password, name);
      if (data?.session) {
        navigate('/');
      } else {
        navigate('/login');
      }
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
      title="Create Account"
      subtitle="Join to start searching, chatting, and extracting insights from your documents."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="signup-name">
            Full Name
          </label>
          <div className={styles.inputWrapper}>
            <IconUser size={18} className={styles.inputIcon} />
            <input
              id="signup-name"
              type="text"
              className={styles.input}
              placeholder="Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="signup-email">
            Email address
          </label>
          <div className={styles.inputWrapper}>
            <IconMail size={18} className={styles.inputIcon} />
            <input
              id="signup-email"
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
          <label className={styles.label} htmlFor="signup-password">
            Password (min. 6 characters)
          </label>
          <div className={styles.inputWrapper}>
            <IconLock size={18} className={styles.inputIcon} />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
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
              <span>Creating account…</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>

        <div className={styles.divider}>
          <span>Or sign up with</span>
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
