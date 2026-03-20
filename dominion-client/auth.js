const SUPABASE_URL = 'https://fccsxtzomgfelmpfdeus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3N4dHpvbWdmZWxtcGZkZXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDczODMsImV4cCI6MjA4MDc4MzM4M30.GWzx1tHoK9tXDjs29BQ9ZrfqBErch7QA6TyvXcxvTkQ';

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const status = document.getElementById('status');

async function login() {
  // Verify ALTCHA
  const altcha = document.querySelector('altcha-widget');
  if (!altcha) {
    status.textContent = "ALTCHA widget not found.";
    return;
  }
  if (altcha.state !== 'verified') {
    status.textContent = "Please complete the challenge.";
    return;
  }

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  status.textContent = "Entering the Realm...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    status.textContent = error.message;
    return;
  }

  localStorage.setItem('access_token', data.session.access_token);

  status.textContent = "Authenticated. Loading world...";

  // Check profile
  const profileRes = await fetch('/profile/me', {
    headers: {
      Authorization: `Bearer ${data.session.access_token}`
    }
  });
  const profile = await profileRes.json();

  if (profile.needsSetup) {
    window.location.href = "create-character.html";
  } else {
    localStorage.setItem('profile', JSON.stringify(profile));
    window.location.href = "game.html";
  }
}

async function signup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  status.textContent = "Forging your legend...";

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    status.textContent = error.message;
    return;
  }

  status.textContent = "Account created. Please log in.";
}

// expose to global for pages that load the module
window.login = login;
window.signup = signup;
