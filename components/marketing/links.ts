/** Public links used by the product page and the branded homepage. */
export const REPO_URL = 'https://github.com/omsingh02/gatekeep';
export const DOCS_URL = `${REPO_URL}/blob/main/docs`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const SECURITY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
export const ACCESS_METHODS_URL = `${DOCS_URL}/ACCESS-METHODS.md`;
export const DEPLOYMENT_URL = `${DOCS_URL}/DEPLOYMENT.md`;
export const DOCKER_URL = `${DOCS_URL}/DOCKER.md`;

/** Vercel's clone flow with the required variables pre-listed (same URL as the README button). */
export const DEPLOY_URL =
    'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fomsingh02%2Fgatekeep' +
    '&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL,CRON_SECRET' +
    '&envDescription=Supabase%20project%20keys%2C%20your%20public%20URL%20and%20a%20random%20cron%20secret' +
    '&envLink=https%3A%2F%2Fgithub.com%2Fomsingh02%2Fgatekeep%2Fblob%2Fmain%2Fdocs%2FDEPLOYMENT.md' +
    '&project-name=gatekeep&repository-name=gatekeep';
