package bo.pasorapa.hato.service.filter.filters;

import java.io.Serializable;
import java.util.Objects;

public class RangeFilter<T extends Comparable<? super T> & Serializable> extends Filter<T> {

    private T greaterThan;
    private T lessThan;
    private T greaterThanOrEqual;
    private T lessThanOrEqual;

    public T getGreaterThan() {
        return greaterThan;
    }

    public void setGreaterThan(T greaterThan) {
        this.greaterThan = greaterThan;
    }

    public T getLessThan() {
        return lessThan;
    }

    public void setLessThan(T lessThan) {
        this.lessThan = lessThan;
    }

    public T getGreaterThanOrEqual() {
        return greaterThanOrEqual;
    }

    public void setGreaterThanOrEqual(T greaterThanOrEqual) {
        this.greaterThanOrEqual = greaterThanOrEqual;
    }

    public T getLessThanOrEqual() {
        return lessThanOrEqual;
    }

    public void setLessThanOrEqual(T lessThanOrEqual) {
        this.lessThanOrEqual = lessThanOrEqual;
    }

    @Override
    public boolean hasValues() {
        return super.hasValues()
                || greaterThan != null
                || lessThan != null
                || greaterThanOrEqual != null
                || lessThanOrEqual != null;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass() || !super.equals(o)) {
            return false;
        }
        RangeFilter<?> that = (RangeFilter<?>) o;
        return Objects.equals(greaterThan, that.greaterThan)
                && Objects.equals(lessThan, that.lessThan)
                && Objects.equals(greaterThanOrEqual, that.greaterThanOrEqual)
                && Objects.equals(lessThanOrEqual, that.lessThanOrEqual);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual);
    }
}

