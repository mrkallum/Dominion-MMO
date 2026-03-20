# Migrating to Version 2.3.0

## Summary

A reported vulnerability, [CVE-2025-65849](https://www.cve.org/CVERecord?id=CVE-2025-65849), is currently marked as *disputed* but is still flagged by vulnerability scanners such as `npm audit`.
As a result, version **2.3.0** moves the obfuscation and other plugins out of the main package into a new package: `@altcha/plugins`.

## Installation

If you use any plugins (such as obfuscation), install the new package explicitly:

```bash
npm install @altcha/plugins
```

If you do **not** use any plugins, no additional installation or code changes are required.

## Migration Steps

Plugins are no longer bundled with the main package and must be imported explicitly from `@altcha/plugins`.

**Before (≤ 2.2.4):**

```js
import 'altcha/obfuscation';
import 'altcha';
```

**After (≥ 2.3.0):**

```js
import '@altcha/plugins/obfuscation';
import 'altcha';
```

If you are not importing any plugins, your existing setup continues to work unchanged.

## Rationale

The reported issue describes a cryptographic limitation (an algebraic bypass) of the AES-GCM authentication mechanism, not an exploitable vulnerability in the widget itself. This limitation cannot be mitigated within the widget’s scope.

To prevent false-positive reports in tools like `npm audit`, the affected obfuscation plugin has been extracted into a separate package. If you do not use obfuscation, version 2.3.0 removes the problematic code entirely. If you do use it, you must accept the documented limitations:

[https://altcha.org/docs/v2/obfuscation/#complexity-and-automation](https://altcha.org/docs/v2/obfuscation/#complexity-and-automation)

Additional context:
[https://github.com/github/advisory-database/pull/6536#issuecomment-3645647102](https://github.com/github/advisory-database/pull/6536#issuecomment-3645647102)
