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
      bindDN: "uid={{user}},ou=accounts,dc=mf,dc=de",
      entitlements: {
        base: "ou=groups,dc=mf,dc=de",
        attribute: "cn",
        scope: "sub",
        filter:
          "(&(objectclass=groupOfUniqueNames)(uniqueMember=uid={{user}},ou=accounts,dc=mf,dc=de))"
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
 * @param entitlementFilter
 * @return {Set<string>} entitlements
 */
export async function authenticate(
  config,
  username,
  password,
  entitlementFilter = e => true
) {
  const auth = config.auth;

  const entitlements = new Set();

  const ldap = auth.ldap;
  if (ldap !== undefined) {
    const client = new ldapts.Client({
      url: ldap.url
    });

    function inject(str) {
      return str.replace(/\{\{user\}\}/, username);
    }

    try {
      //console.log("BIND", inject(ldap.bindDN));
      await client.bind(inject(ldap.bindDN), password);

      const { searchEntries } = await client.search(
        inject(ldap.entitlements.base),
        {
          scope: ldap.entitlements.scope,
          filter: inject(ldap.entitlements.filter),
          attributes: [ldap.entitlements.attribute]
        }
      );
      searchEntries.forEach(e => {
        const entitlement = e[ldap.entitlements.attribute];
        if (entitlementFilter(entitlement)) {
          entitlements.add(entitlement);
        }
      });
    } catch (ex) {
      console.log(ex);
    } finally {
      await client.unbind();
    }
  }

  if (auth.users !== undefined) {
    const user = auth.users[username];
    if (user !== undefined && user.password === password) {
      user.entitlements.forEach(e => entitlements.add(e));
    }
  }

  return { entitlements };
}

export function accessTokenGenerator(config,
  entitlementFilter = e => true) {
  return async (ctx, next) => {
    const q = ctx.request.body;

    const { entitlements } = await authenticate(
      config,
      q.username,
      q.password,
      entitlementFilter
    );

    if (entitlements.size > 0) {
      const claims = {
        entitlements: [...entitlements].join(",")
      };

      const token = jsonwebtoken.sign(
        claims,
        config.auth.jwt.private,
        config.auth.jwt.options
      );

      ctx.body = {
        token
      };
    } else {
      ctx.throw(401, "Authentication failed");
    }

    return next();
  };
}
