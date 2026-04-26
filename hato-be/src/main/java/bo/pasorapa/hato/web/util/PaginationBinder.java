package bo.pasorapa.hato.web.util;

import bo.pasorapa.hato.service.page.PageRequest;
import bo.pasorapa.hato.service.page.Sort;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;

public final class PaginationBinder {

    private PaginationBinder() {
    }

    public static PageRequest bind(UriInfo uriInfo) {
        MultivaluedMap<String, String> query = uriInfo.getQueryParameters();
        int page = parseIntSafe(query.getFirst("page"), 0);
        int size = parseIntSafe(query.getFirst("size"), 20);
        return new PageRequest(page, size, parseSort(query.get("sort")));
    }

    static int parseIntSafe(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException exception) {
            return defaultValue;
        }
    }

    static Sort parseSort(List<String> sortParams) {
        if (sortParams == null || sortParams.isEmpty()) {
            return null;
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (String sortParam : sortParams) {
            if (sortParam == null || sortParam.isBlank()) {
                continue;
            }
            String[] parts = sortParam.split(",", 2);
            String property = parts[0].trim();
            if (property.isEmpty()) {
                continue;
            }
            Sort.Direction direction = Sort.Direction.ASC;
            if (parts.length == 2 && "desc".equalsIgnoreCase(parts[1].trim())) {
                direction = Sort.Direction.DESC;
            }
            orders.add(new Sort.Order(direction, property));
        }
        return orders.isEmpty() ? null : new Sort(orders);
    }
}

