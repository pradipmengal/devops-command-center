import ssl
import socket
from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from cryptography import x509
from cryptography.x509.oid import NameOID

router = APIRouter(prefix="/ssl", tags=["ssl"])


class SslRequest(BaseModel):
    host: str
    port: int = 443


OID_LABELS = {
    NameOID.COUNTRY_NAME: "C",
    NameOID.STATE_OR_PROVINCE_NAME: "ST",
    NameOID.LOCALITY_NAME: "L",
    NameOID.ORGANIZATION_NAME: "O",
    NameOID.ORGANIZATIONAL_UNIT_NAME: "OU",
    NameOID.COMMON_NAME: "CN",
    NameOID.SERIAL_NUMBER: "SN",
    NameOID.EMAIL_ADDRESS: "E",
    NameOID.DOMAIN_COMPONENT: "DC",
    NameOID.POSTAL_CODE: "POSTAL_CODE",
    NameOID.STREET_ADDRESS: "STREET",
    NameOID.BUSINESS_CATEGORY: "BUSINESS_CATEGORY",
}


def _format_name(name: x509.Name) -> list[dict[str, str]]:
    parts = []
    for attr in name:
        label = OID_LABELS.get(attr.oid, attr.oid._name)
        parts.append({"label": label, "value": attr.value})
    return parts


@router.post("/inspect")
async def inspect_ssl(request: SslRequest):
    host = request.host.strip()
    port = request.port

    if not host:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "Host cannot be empty"}},
        )

    if port < 1 or port > 65535:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": "Port must be between 1 and 65535"}},
        )

    try:
        cert_der = None
        chain_ders: list[bytes] = []
        tls_version = "Unknown"
        verified = False
        error_hint = None

        for mode in [ssl.CERT_REQUIRED, ssl.CERT_NONE]:
            try:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = mode

                with socket.create_connection((host, port), timeout=10) as sock:
                    with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                        tls_version = ssock.version() or "Unknown"
                        cert_der = ssock.getpeercert(binary_form=True)
                        if cert_der is None:
                            raise ValueError("No certificate returned")

                        try:
                            chain_ders = ssock.get_verified_chain() or []
                        except Exception:
                            chain_ders = []

                        if mode == ssl.CERT_REQUIRED:
                            verified = True
                        break

            except ssl.SSLCertVerificationError:
                error_hint = str(e)
                continue
            except ssl.SSLError:
                continue

        if cert_der is None:
            return JSONResponse(
                status_code=422,
                content={
                    "status": "error",
                    "data": {"message": f"Could not establish TLS connection to {host}:{port}. The host may not support TLS or the port may be incorrect."}
                },
            )

        cert = x509.load_der_x509_certificate(cert_der)

        now = datetime.now(timezone.utc)
        not_before = cert.not_valid_before_utc
        not_after = cert.not_valid_after_utc
        days_remaining = (not_after - now).days
        expired = days_remaining < 0

        sans = []
        try:
            san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            sans = san_ext.value.get_values_for_type(x509.DNSName)
        except x509.ExtensionNotFound:
            pass

        fingerprint = cert.fingerprint(cert.signature_hash_algorithm).hex(":").upper()
        serial = format(cert.serial_number, "X")
        serial_bytes = (cert.serial_number.bit_length() + 7) // 8

        is_ca = False
        try:
            basic_constraints = cert.extensions.get_extension_for_class(x509.BasicConstraints)
            is_ca = basic_constraints.value.ca
        except x509.ExtensionNotFound:
            pass

        self_signed = cert.subject == cert.issuer

        chain_info = []
        all_ders = [cert_der] + chain_ders
        seen = set()
        for i, der in enumerate(all_ders):
            der_bytes = bytes(der)
            if der_bytes in seen:
                continue
            seen.add(der_bytes)
            try:
                c = x509.load_der_x509_certificate(der_bytes)
                cs = c.subject == c.issuer
                chain_info.append({
                    "subject": _format_name(c.subject),
                    "issuer": _format_name(c.issuer),
                    "self_signed": cs,
                })
            except Exception:
                pass

        return {
            "status": "success",
            "data": {
                "host": host,
                "port": port,
                "subject": _format_name(cert.subject),
                "issuer": _format_name(cert.issuer),
                "issued_at": not_before.isoformat(),
                "expires_at": not_after.isoformat(),
                "days_remaining": days_remaining,
                "expired": expired,
                "self_signed": self_signed,
                "is_ca": is_ca,
                "verified": verified,
                "sans": sans,
                "fingerprint_sha256": fingerprint,
                "tls_version": tls_version,
                "serial_number": serial,
                "serial_bytes": serial_bytes,
                "signature_algorithm": cert.signature_hash_algorithm.name if cert.signature_hash_algorithm else "Unknown",
                "public_key_bits": cert.public_key().key_size if hasattr(cert.public_key(), "key_size") else 0,
                "chain": chain_info,
                "chain_length": len(chain_info),
            },
        }

    except socket.gaierror as e:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": f"Host not found: {host}. Check the domain name and try again."}},
        )
    except socket.timeout:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": f"Connection timed out connecting to {host}:{port}. The host may be unreachable or blocking connections."}},
        )
    except ConnectionRefusedError:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": f"Connection refused by {host}:{port}. The port may be closed or not accepting TLS connections."}},
        )
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "data": {"message": f"SSL inspection failed: {str(e)}"}},
        )
