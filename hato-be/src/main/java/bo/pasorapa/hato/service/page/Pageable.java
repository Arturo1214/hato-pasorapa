package bo.pasorapa.hato.service.page;

public interface Pageable {
    int getPageNumber();

    int getPageSize();

    Sort getSort();
}

