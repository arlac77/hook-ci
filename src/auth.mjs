
export const defaultAuthConfig = {
  oauth2: {
    applicationId: 'hook-ci',
    authorizationURL:"${env.OAUTH2_AUTHORIZATION_URL}",
    clientSecret: "${env.OAUTH2_CLIENT_SECRET}",
    clientId: "${env.OAUTH2_CLIENT_ID}"
  }
};