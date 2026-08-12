package bo.pasorapa.hato.service.page;

import java.util.Objects;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class PageRequest implements Pageable {

    private final int pageNumber;
    private final int pageSize;
    private final Sort sort;

    public PageRequest(int pageNumber, int pageSize, Sort sort) {
        if (pageNumber < 0) {
            throw new IllegalArgumentException("El número de página no puede ser negativo");
        }
        if (pageSize <= 0) {
            throw new IllegalArgumentException("El tamaño de página debe ser mayor a 0");
        }
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.sort = sort;
    }

    @Override
    public int getPageNumber() {
        return pageNumber;
    }

    @Override
    public int getPageSize() {
        return pageSize;
    }

    @Override
    public Sort getSort() {
        return sort;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PageRequest that = (PageRequest) o;
        return pageNumber == that.pageNumber && pageSize == that.pageSize && Objects.equals(sort, that.sort);
    }

    @Override
    public int hashCode() {
        return Objects.hash(pageNumber, pageSize, sort);
    }
}

