package bo.pasorapa.hato.service.page;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

public class Page<T> {

    private final List<T> content;
    private final long totalElements;
    private final int totalPages;
    private final Pageable pageable;

    public Page(List<T> content, Pageable pageable, long totalElements) {
        this.content = content;
        this.pageable = pageable;
        this.totalElements = totalElements;
        this.totalPages = pageable == null ? 0 : (int) Math.ceil((double) totalElements / pageable.getPageSize());
    }

    public List<T> getContent() {
        return content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public Pageable getPageable() {
        return pageable;
    }

    public boolean isLast() {
        return pageable == null || pageable.getPageNumber() >= totalPages - 1;
    }

    public <R> Page<R> map(Function<? super T, ? extends R> mapper) {
        List<R> mapped = content.stream().map(mapper).collect(Collectors.toCollection(ArrayList::new));
        return new Page<>(mapped, pageable, totalElements);
    }
}

