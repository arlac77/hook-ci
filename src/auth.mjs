import ldapts from "ldapts";
import jsonwebtoken from "jsonwebtoken";

export const defaultAuthConfig = {
  auth: {
    oauth2: {
      applicationId: "hook-ci",
      authorizationURL: "${env.OAUTH2_AUTHORIZATION_URL}",
      clientSecret: "${env.OAUTH2_CLIENT_SECRET}",
      clientId: "${env.OAUTH2_CLIENT_ID}"
    },
    ldap: {
      url: "ldap://ldap.mf.de",
      bindDN: "uid={{username}},ou=accounts,dc=mf,dc=de",
      entitlements: {
        base: "ou=groups,dc=mf,dc=de",
        attribute: "cn",
        scope: "sub",
        filter:
          "(&(objectclass=groupOfUniqueNames)(uniqueMember=uid={{username}},ou=accounts,dc=mf,dc=de))"
      }
    },
    jwt: {
      options: {
        algorithm: "RS256",
        expiresIn: "12h"
      }
    },
    users: {}
  }
};

/**
 * authorize user / password
 * @param {Object} config
 * @param {string} username
 * @param {string} password
 * @return {Set<string>} entitlements
 */
export async function authenticate(config, username, password) {
  const auth = config.auth;

  const entitlements = new Set();

  const ldap = auth.ldap;
  if (ldap !== undefined) {
    const client = new ldapts.Client({
      url: ldap.url
    });

    const values = {
      username
    };

    function expand(str) {
      return str.replace(/\{\{(\w+)\}\}/, (match, g1) => values[g1] ? values[g1] : g1);
    }

    try {
      console.log("BIND", expand(ldap.bindDN));
      await client.bind(expand(ldap.bindDN), password);

      const { searchEntries } = await client.search(
        expand(ldap.entitlements.base),
        {
          scope: ldap.entitlements.scope,
          filter: expand(ldap.entitlements.filter),
          attributes: [ldap.entitlements.attribute]
        }
      );
      searchEntries.forEach(e => {
        const entitlement = e[ldap.entitlements.attribute];
        entitlements.add(entitlement);
      });
    } finally {
      await client.unbind();
    }
  }

  if (auth.users !== undefined) {
    const user = auth.users[username];
    if (user !== undefined) {
      if (user.password === password) {
        user.entitlements.forEach(e => entitlements.add(e));
      }
      else {
        throw new Error("Wrong credentials");
      }
    }
  }

  return { entitlements };
}

/**
 * Geenrate a request handler to deliver JWT access tokens
 * @param {Object} config
 * @param {Function} entitlementFilter
 * @return request handler return jwt token
 */
export function accessTokenGenerator(config, entitlementFilter) {
  return async (ctx, next) => {
    const q = ctx.request.body;

    let entitlements;

    try {
      const x = await authenticate(config, q.username, q.password);
      entitlements = x.entitlements;
    } catch (e) {
      console.log(e);
      ctx.throw(401, "Authentication failed");
    }

    const e =
      entitlementFilter === undefined
        ? [...entitlements]
        : [...entitlements].filter(e => entitlementFilter(e));

    if (e.length > 0) {
      const access_token = jsonwebtoken.sign(
        { entitlements: e.join(",") },
        config.auth.jwt.private,
        config.auth.jwt.options
      );

      ctx.body = {
        access_token
      };
      return next();
    } else {
      ctx.throw(403, "Not authorized");
    }
  };
}
