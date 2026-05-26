import ipaddress
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/subnet", tags=["subnet"])


class SubnetRequest(BaseModel):
    cidr: str


@router.post("/calculate")
async def calculate_subnet(request: SubnetRequest):
    try:
        network = ipaddress.IPv4Network(request.cidr.strip(), strict=False)

        hosts = list(network.hosts())
        num_hosts = len(hosts)

        first_host = str(hosts[0]) if hosts else "N/A"
        last_host = str(hosts[-1]) if hosts else "N/A"

        # Wildcard mask = inverse of subnet mask
        mask_int = int(network.netmask)
        wildcard_int = 0xFFFFFFFF ^ mask_int
        wildcard = str(ipaddress.IPv4Address(wildcard_int))

        return {
            "status": "success",
            "data": {
                "cidr": str(network),
                "network_address": str(network.network_address),
                "broadcast_address": str(network.broadcast_address),
                "subnet_mask": str(network.netmask),
                "wildcard_mask": wildcard,
                "prefix_length": network.prefixlen,
                "total_addresses": network.num_addresses,
                "usable_hosts": num_hosts,
                "first_host": first_host,
                "last_host": last_host,
                "ip_class": _get_ip_class(str(network.network_address)),
                "is_private": network.is_private,
                "is_loopback": network.is_loopback,
            },
        }
    except ValueError as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid CIDR notation: {str(e)}. Example: 192.168.1.0/24"}
            },
        )


def _get_ip_class(ip: str) -> str:
    first_octet = int(ip.split(".")[0])
    if first_octet < 128:
        return "A"
    elif first_octet < 192:
        return "B"
    elif first_octet < 224:
        return "C"
    elif first_octet < 240:
        return "D (Multicast)"
    else:
        return "E (Reserved)"
