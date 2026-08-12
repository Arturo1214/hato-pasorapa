package bo.pasorapa.hato.service.filter.filters;

import java.io.Serializable;
import java.util.List;
import java.util.Objects;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public abstract class Filter<T extends Serializable> implements Serializable {

    private T equals;
    private T notEquals;
    private Boolean specified;
    private List<T> in;

    public T getEquals() {
        return equals;
    }

    public void setEquals(T equals) {
        this.equals = equals;
    }

    public T getNotEquals() {
        return notEquals;
    }

    public void setNotEquals(T notEquals) {
        this.notEquals = notEquals;
    }

    public Boolean getSpecified() {
        return specified;
    }

    public void setSpecified(Boolean specified) {
        this.specified = specified;
    }

    public List<T> getIn() {
        return in;
    }

    public void setIn(List<T> in) {
        this.in = in;
    }

    public boolean hasValues() {
        return equals != null
                || notEquals != null
                || specified != null
                || (in != null && !in.isEmpty());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Filter<?> filter = (Filter<?>) o;
        return Objects.equals(equals, filter.equals)
                && Objects.equals(notEquals, filter.notEquals)
                && Objects.equals(specified, filter.specified)
                && Objects.equals(in, filter.in);
    }

    @Override
    public int hashCode() {
        return Objects.hash(equals, notEquals, specified, in);
    }
}

