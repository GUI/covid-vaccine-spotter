--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1
-- Dumped by pg_dump version 13.2 (Debian 13.2-1.pgdg100+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA audit;


--
-- Name: SCHEMA audit; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA audit IS 'Out-of-table audit/history logging tables and trigger functions';


--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: audit_table(regclass); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass) RETURNS void
    LANGUAGE sql
    AS $_$
      SELECT audit.audit_table($1, BOOLEAN 't', BOOLEAN 't');
    $_$;


--
-- Name: FUNCTION audit_table(target_table regclass); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON FUNCTION audit.audit_table(target_table regclass) IS '
    Add auditing support to the given table. Row-level changes will be logged with
    full client query text. No cols are ignored.
    ';


--
-- Name: audit_table(regclass, boolean, boolean); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean) RETURNS void
    LANGUAGE sql
    AS $_$
      SELECT audit.audit_table($1, $2, $3, ARRAY[]::TEXT[]);
    $_$;


--
-- Name: audit_table(regclass, boolean, boolean, text[]); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean, ignored_cols text[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      stm_targets TEXT = 'INSERT OR UPDATE OR DELETE OR TRUNCATE';
      _q_txt TEXT;
      _ignored_cols_snip TEXT = '';
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_row ON ' || target_table::TEXT;
      EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_stm ON ' || target_table::TEXT;

      IF audit_rows THEN
        IF array_length(ignored_cols,1) > 0 THEN
            _ignored_cols_snip = ', ' || quote_literal(ignored_cols);
        END IF;
        _q_txt = 'CREATE TRIGGER audit_trigger_row '
                 'AFTER INSERT OR UPDATE OR DELETE ON ' ||
                 target_table::TEXT ||
                 ' FOR EACH ROW EXECUTE PROCEDURE audit.if_modified_func(' ||
                 quote_literal(audit_query_text) ||
                 _ignored_cols_snip ||
                 ');';
        RAISE NOTICE '%', _q_txt;
        EXECUTE _q_txt;
        stm_targets = 'TRUNCATE';
      END IF;

      _q_txt = 'CREATE TRIGGER audit_trigger_stm AFTER ' || stm_targets || ' ON ' ||
               target_table ||
               ' FOR EACH STATEMENT EXECUTE PROCEDURE audit.if_modified_func('||
               quote_literal(audit_query_text) || ');';
      RAISE NOTICE '%', _q_txt;
      EXECUTE _q_txt;
    END;
    $$;


--
-- Name: FUNCTION audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean, ignored_cols text[]); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON FUNCTION audit.audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean, ignored_cols text[]) IS '
    Add auditing support to a table.

    Arguments:
       target_table:     Table name, schema qualified if not on search_path
       audit_rows:       Record each row change, or only audit at a statement level
       audit_query_text: Record the text of the client query that triggered
                         the audit event?
       ignored_cols:     Columns to exclude from update diffs,
                         ignore updates that change only ignored cols.
    ';


--
-- Name: if_modified_func(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.if_modified_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
    DECLARE
        audit_row audit.log;
        include_values BOOLEAN;
        log_diffs BOOLEAN;
        h_old JSONB;
        h_new JSONB;
        excluded_cols TEXT[] = ARRAY[]::TEXT[];
    BEGIN
      IF TG_WHEN <> 'AFTER' THEN
        RAISE EXCEPTION 'audit.if_modified_func() may only run as an AFTER trigger';
      END IF;

      audit_row = ROW(
        nextval('audit.log_id_seq'),                    -- id
        TG_TABLE_SCHEMA::TEXT,                          -- schema_name
        TG_TABLE_NAME::TEXT,                            -- table_name
        TG_RELID,                                       -- relation OID for faster searches
        session_user::TEXT,                             -- session_user_name
        current_user::TEXT,                             -- current_user_name
        current_timestamp,                              -- action_tstamp_tx
        statement_timestamp(),                          -- action_tstamp_stm
        clock_timestamp(),                              -- action_tstamp_clk
        txid_current(),                                 -- transaction ID
        current_setting('audit.application_name', true),      -- client application
        current_setting('audit.application_user_name', true), -- client user name
        inet_client_addr(),                             -- client_addr
        inet_client_port(),                             -- client_port
        current_query(),                                -- top-level query or queries
        substring(TG_OP, 1, 1),                         -- action
        NULL,                                           -- row_data
        NULL,                                           -- changed_fields
        'f'                                             -- statement_only
        );

      IF NOT TG_ARGV[0]::BOOLEAN IS DISTINCT FROM 'f'::BOOLEAN THEN
        audit_row.client_query = NULL;
      END IF;

      IF TG_ARGV[1] IS NOT NULL THEN
        excluded_cols = TG_ARGV[1]::TEXT[];
      END IF;

      IF (TG_OP = 'INSERT' AND TG_LEVEL = 'ROW') THEN
        audit_row.changed_fields = to_jsonb(NEW.*);
      ELSIF (TG_OP = 'UPDATE' AND TG_LEVEL = 'ROW') THEN
        audit_row.row_data = to_jsonb(OLD.*);
        audit_row.changed_fields =
          (to_jsonb(NEW.*) OPERATOR(audit.-) audit_row.row_data) OPERATOR(audit.-) excluded_cols;
        IF audit_row.changed_fields = '{}'::JSONB THEN
          -- All changed fields are ignored. Skip this update.
          RETURN NULL;
        END IF;
        audit_row.changed_fields =
          (to_jsonb(NEW.*) OPERATOR(audit.-) audit_row.row_data);
      ELSIF (TG_OP = 'DELETE' AND TG_LEVEL = 'ROW') THEN
        audit_row.row_data = to_jsonb(OLD.*);
      ELSIF (TG_LEVEL = 'STATEMENT' AND
             TG_OP IN ('INSERT','UPDATE','DELETE','TRUNCATE')) THEN
        audit_row.statement_only = 't';
      ELSE
        RAISE EXCEPTION '[audit.if_modified_func] - Trigger func added as trigger '
                        'for unhandled case: %, %', TG_OP, TG_LEVEL;
        RETURN NULL;
      END IF;
      INSERT INTO audit.log VALUES (audit_row.*);
      RETURN NULL;
    END;
    $$;


--
-- Name: FUNCTION if_modified_func(); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON FUNCTION audit.if_modified_func() IS '
    Track changes to a table at the statement and/or row level.

    Optional parameters to trigger in CREATE TRIGGER call:

    param 0: BOOLEAN, whether to log the query text. Default ''t''.

    param 1: TEXT[], columns to ignore in updates. Default [].

             Updates to ignored cols are omitted from changed_fields.

             Updates with only ignored cols changed are not inserted
             into the audit log.

             Almost all the processing work is still done for updates
             that ignored. If you need to save the load, you need to use
             WHEN clause on the trigger instead.

             No warning or error is issued if ignored_cols contains columns
             that do not exist in the target table. This lets you specify
             a standard set of ignored columns.

    There is no parameter to disable logging of values. Add this trigger as
    a ''FOR EACH STATEMENT'' rather than ''FOR EACH ROW'' trigger if you do not
    want to log row values.

    Note that the user name logged is the login role for the session. The audit
    trigger cannot obtain the active role because it is reset by
    the SECURITY DEFINER invocation of the audit trigger its self.
    ';


--
-- Name: jsonb_minus(jsonb, text[]); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.jsonb_minus("left" jsonb, keys text[]) RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      SELECT
        CASE
          WHEN "left" ?| "keys"
            THEN COALESCE(
              (SELECT ('{' ||
                        string_agg(to_json("key")::TEXT || ':' || "value", ',') ||
                        '}')
                 FROM jsonb_each("left")
                WHERE "key" <> ALL ("keys")),
              '{}'
            )::JSONB
          ELSE "left"
        END
    $$;


--
-- Name: FUNCTION jsonb_minus("left" jsonb, keys text[]); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON FUNCTION audit.jsonb_minus("left" jsonb, keys text[]) IS 'Delete specificed keys';


--
-- Name: jsonb_minus(jsonb, jsonb); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.jsonb_minus("left" jsonb, "right" jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      SELECT
        COALESCE(json_object_agg(
          "key",
          CASE
            -- if the value is an object and the value of the second argument is
            -- not null, we do a recursion
            WHEN jsonb_typeof("value") = 'object' AND "right" -> "key" IS NOT NULL
            THEN audit.jsonb_minus("value", "right" -> "key")
            -- for all the other types, we just return the value
            ELSE "value"
          END
        ), '{}')::JSONB
      FROM
        jsonb_each("left")
      WHERE
        "left" -> "key" <> "right" -> "key"
        OR "right" -> "key" IS NULL
    $$;


--
-- Name: FUNCTION jsonb_minus("left" jsonb, "right" jsonb); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON FUNCTION audit.jsonb_minus("left" jsonb, "right" jsonb) IS 'Delete matching pairs in the right argument from the left argument';


--
-- Name: make_rect_grid(public.geometry, double precision, double precision, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_rect_grid(geom public.geometry, height_meters double precision, width_meters double precision, use_envelope boolean DEFAULT false, OUT public.geometry) RETURNS SETOF public.geometry
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$ DECLARE
        x_max DECIMAL;
        y_max DECIMAL;
        x_min DECIMAL;
        y_min DECIMAL;
        srid INTEGER := 2163;
        input_srid INTEGER;
        x_series DECIMAL;
        y_series DECIMAL;
    BEGIN
      CASE st_srid ( geom ) WHEN 0 THEN
        geom := ST_SetSRID ( geom, srid );
        RAISE NOTICE'SRID Not Found.';
      ELSE
        RAISE NOTICE'SRID Found.';
      END CASE;
      input_srid := st_srid ( geom );
      geom := st_transform ( geom, srid );
        CASE use_envelope WHEN true THEN
          geom := st_envelope(geom);
            RAISE NOTICE'Using min/max for ST_Envelope on geom';
        ELSE
            RAISE NOTICE'Using min/max for geom';
        END CASE;
      x_max := ST_XMax ( geom );
      y_max := ST_YMax ( geom );
      x_min := ST_XMin ( geom );
      y_min := ST_YMin ( geom );
      x_series := ceil ( @( x_max - x_min ) / height_meters );
      y_series := ceil ( @( y_max - y_min ) / width_meters );
      RETURN QUERY
            WITH res AS (
                SELECT
                    st_collect (st_setsrid ( ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid )) AS grid
                FROM
                    generate_series ( 0, x_series ) AS j,
                    generate_series ( 0, y_series ) AS i,
                    (
                        SELECT ( 'POLYGON((0 0, 0 ' ||$3 || ', ' ||$2 || ' ' ||$3 || ', ' ||$2 || ' 0,0 0))' ) :: geometry AS cell
                    ) AS foo WHERE ST_Intersects ( st_setsrid ( ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid ), geom )
        ) SELECT st_transform ( grid, input_srid ) FROM res;
    END;
    $_$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
            BEGIN
              -- Detect changes using *<> operator which is compatible with "point"
              -- types that "DISTINCT FROM" is not:
              -- https://www.mail-archive.com/pgsql-general@postgresql.org/msg198866.html
              -- https://www.postgresql.org/docs/10/functions-comparisons.html#COMPOSITE-TYPE-COMPARISON
              IF NEW *<> OLD THEN
                NEW.updated_at := transaction_timestamp();
              END IF;

              RETURN NEW;
            END;
            $$;


--
-- Name: -; Type: OPERATOR; Schema: audit; Owner: -
--

CREATE OPERATOR audit.- (
    FUNCTION = audit.jsonb_minus,
    LEFTARG = jsonb,
    RIGHTARG = text[]
);


--
-- Name: -; Type: OPERATOR; Schema: audit; Owner: -
--

CREATE OPERATOR audit.- (
    FUNCTION = audit.jsonb_minus,
    LEFTARG = jsonb,
    RIGHTARG = jsonb
);


--
-- Name: OPERATOR - (jsonb, jsonb); Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON OPERATOR audit.- (jsonb, jsonb) IS 'Delete matching pairs in the right argument from the left argument';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: log; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.log (
    id bigint NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    relid oid NOT NULL,
    session_user_name text NOT NULL,
    current_user_name text NOT NULL,
    action_tstamp_tx timestamp with time zone NOT NULL,
    action_tstamp_stm timestamp with time zone NOT NULL,
    action_tstamp_clk timestamp with time zone NOT NULL,
    transaction_id bigint NOT NULL,
    application_name text,
    application_user_name text,
    client_addr inet,
    client_port integer,
    client_query text,
    action text NOT NULL,
    row_data jsonb,
    changed_fields jsonb,
    statement_only boolean NOT NULL,
    CONSTRAINT log_action_check CHECK ((action = ANY (ARRAY['I'::text, 'D'::text, 'U'::text, 'T'::text])))
);


--
-- Name: TABLE log; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON TABLE audit.log IS 'History of auditable actions on audited tables';


--
-- Name: COLUMN log.id; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.id IS 'Unique identifier for each auditable event';


--
-- Name: COLUMN log.schema_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.schema_name IS 'Database schema audited table for this event is in';


--
-- Name: COLUMN log.table_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.table_name IS 'Non-schema-qualified table name of table event occured in';


--
-- Name: COLUMN log.relid; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.relid IS 'Table OID. Changes with drop/create. Get with ''tablename''::REGCLASS';


--
-- Name: COLUMN log.session_user_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.session_user_name IS 'Login / session user whose statement caused the audited event';


--
-- Name: COLUMN log.current_user_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.current_user_name IS 'Effective user that cased audited event (if authorization level changed)';


--
-- Name: COLUMN log.action_tstamp_tx; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.action_tstamp_tx IS 'Transaction start timestamp for tx in which audited event occurred';


--
-- Name: COLUMN log.action_tstamp_stm; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.action_tstamp_stm IS 'Statement start timestamp for tx in which audited event occurred';


--
-- Name: COLUMN log.action_tstamp_clk; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.action_tstamp_clk IS 'Wall clock time at which audited event''s trigger call occurred';


--
-- Name: COLUMN log.transaction_id; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.transaction_id IS 'Identifier of transaction that made the change. Unique when paired with action_tstamp_tx.';


--
-- Name: COLUMN log.application_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.application_name IS 'Client-set session application name when this audit event occurred.';


--
-- Name: COLUMN log.application_user_name; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.application_user_name IS 'Client-set session application user when this audit event occurred.';


--
-- Name: COLUMN log.client_addr; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.client_addr IS 'IP address of client that issued query. Null for unix domain socket.';


--
-- Name: COLUMN log.client_port; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.client_port IS 'Port address of client that issued query. Undefined for unix socket.';


--
-- Name: COLUMN log.client_query; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.client_query IS 'Top-level query that caused this auditable event. May be more than one.';


--
-- Name: COLUMN log.action; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.action IS 'Action type; I = insert, D = delete, U = update, T = truncate';


--
-- Name: COLUMN log.row_data; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.row_data IS 'Record value. Null for statement-level trigger. For INSERT this is null. For DELETE and UPDATE it is the old tuple.';


--
-- Name: COLUMN log.changed_fields; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.changed_fields IS 'New values of fields for INSERT or changed by UPDATE. Null for DELETE';


--
-- Name: COLUMN log.statement_only; Type: COMMENT; Schema: audit; Owner: -
--

COMMENT ON COLUMN audit.log.statement_only IS '''t'' if audit event is from an FOR EACH STATEMENT trigger, ''f'' for FOR EACH ROW';


--
-- Name: log_id_seq; Type: SEQUENCE; Schema: audit; Owner: -
--

CREATE SEQUENCE audit.log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: log_id_seq; Type: SEQUENCE OWNED BY; Schema: audit; Owner: -
--

ALTER SEQUENCE audit.log_id_seq OWNED BY audit.log.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    id character varying(255) NOT NULL,
    value jsonb
);


--
-- Name: country_grid_110km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_110km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_11km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_11km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_220km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_220km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_22km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_22km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_55km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: postal_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postal_codes (
    id integer NOT NULL,
    state_code character varying(2) NOT NULL,
    postal_code character varying(5) NOT NULL,
    city character varying(255) NOT NULL,
    county_name character varying(255) NOT NULL,
    county_code character varying(255),
    location public.geography(Point,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    time_zone character varying(255)
);


--
-- Name: postal_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postal_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postal_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postal_codes_id_seq OWNED BY public.postal_codes.id;


--
-- Name: provider_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_brands (
    id integer NOT NULL,
    provider_id character varying(255) NOT NULL,
    key character varying(255),
    name character varying(255),
    url character varying(255)
);


--
-- Name: provider_brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.provider_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provider_brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.provider_brands_id_seq OWNED BY public.provider_brands.id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id character varying(255) NOT NULL
);


--
-- Name: state_grid_110km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_110km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_11km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_11km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_220km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_220km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_22km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_22km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_500k_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_500k_55km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_55km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id integer NOT NULL,
    country_code character varying(2) NOT NULL,
    code character varying(2) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    boundaries public.geography(MultiPolygon,4326),
    boundaries_500k public.geography(MultiPolygon,4326),
    boundaries_5m public.geography(MultiPolygon,4326)
);


--
-- Name: states_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.states_id_seq OWNED BY public.states.id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    brand character varying(255) NOT NULL,
    brand_id character varying(255) NOT NULL,
    name character varying(255),
    address character varying(255),
    city character varying(255),
    state character varying(255),
    postal_code character varying(255),
    location public.geography(Point,4326),
    metadata_raw jsonb,
    carries_vaccine boolean,
    appointments jsonb,
    appointments_available boolean,
    appointments_last_fetched timestamp with time zone,
    appointments_raw jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    time_zone character varying(255),
    active boolean DEFAULT true NOT NULL,
    provider_id character varying(255),
    provider_location_id character varying(255),
    provider_brand_id integer,
    location_source character varying(255),
    url character varying(255),
    normalized_address_key character varying(255),
    appointment_types jsonb,
    appointment_vaccine_types jsonb,
    appointments_last_modified timestamp with time zone
);


--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- Name: walgreens_grid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.walgreens_grid (
    id integer NOT NULL,
    state_code character varying(2),
    geom public.geometry(MultiPolygon,4326),
    centroid_location public.geography(Point,4326),
    centroid_postal_code character varying(255),
    centroid_postal_code_state_code character varying(255),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography(Point,4326),
    grid_side_length integer,
    furthest_point numeric(8,2),
    point_count integer
);


--
-- Name: walgreens_grid_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.walgreens_grid_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: walgreens_grid_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.walgreens_grid_id_seq OWNED BY public.walgreens_grid.id;


--
-- Name: log id; Type: DEFAULT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.log ALTER COLUMN id SET DEFAULT nextval('audit.log_id_seq'::regclass);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: postal_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes ALTER COLUMN id SET DEFAULT nextval('public.postal_codes_id_seq'::regclass);


--
-- Name: provider_brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands ALTER COLUMN id SET DEFAULT nextval('public.provider_brands_id_seq'::regclass);


--
-- Name: states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states ALTER COLUMN id SET DEFAULT nextval('public.states_id_seq'::regclass);


--
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- Name: walgreens_grid id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.walgreens_grid ALTER COLUMN id SET DEFAULT nextval('public.walgreens_grid_id_seq'::regclass);


--
-- Name: log log_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.log
    ADD CONSTRAINT log_pkey PRIMARY KEY (id);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (id);


--
-- Name: country_grid_110km country_grid_110km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_110km
    ADD CONSTRAINT country_grid_110km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_11km country_grid_11km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_11km
    ADD CONSTRAINT country_grid_11km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_220km country_grid_220km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_220km
    ADD CONSTRAINT country_grid_220km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_22km country_grid_22km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_22km
    ADD CONSTRAINT country_grid_22km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_55km country_grid_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_55km
    ADD CONSTRAINT country_grid_55km_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: postal_codes postal_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_pkey PRIMARY KEY (id);


--
-- Name: postal_codes postal_codes_postal_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_postal_code_unique UNIQUE (postal_code);


--
-- Name: provider_brands provider_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_pkey PRIMARY KEY (id);


--
-- Name: provider_brands provider_brands_provider_id_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_provider_id_key_unique UNIQUE (provider_id, key);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: state_grid_110km state_grid_110km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_110km
    ADD CONSTRAINT state_grid_110km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_11km state_grid_11km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_11km
    ADD CONSTRAINT state_grid_11km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_220km state_grid_220km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_220km
    ADD CONSTRAINT state_grid_220km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_22km state_grid_22km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_22km
    ADD CONSTRAINT state_grid_22km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_500k_55km state_grid_500k_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_500k_55km
    ADD CONSTRAINT state_grid_500k_55km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_55km state_grid_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_55km
    ADD CONSTRAINT state_grid_55km_pkey PRIMARY KEY (id);


--
-- Name: states states_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_code_unique UNIQUE (code);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: stores stores_brand_brand_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_brand_brand_id_unique UNIQUE (brand, brand_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_provider_id_normalized_address_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_normalized_address_key_unique UNIQUE (provider_id, normalized_address_key);


--
-- Name: stores stores_provider_id_provider_location_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_provider_location_id_unique UNIQUE (provider_id, provider_location_id);


--
-- Name: walgreens_grid walgreens_grid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.walgreens_grid
    ADD CONSTRAINT walgreens_grid_pkey PRIMARY KEY (id);


--
-- Name: audit_log_action_tstamp_tx_index; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX audit_log_action_tstamp_tx_index ON audit.log USING btree (action_tstamp_tx);


--
-- Name: log_action_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_action_idx ON audit.log USING btree (action);


--
-- Name: log_action_tstamp_tx_stm_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_action_tstamp_tx_stm_idx ON audit.log USING btree (action_tstamp_stm);


--
-- Name: log_relid_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_relid_idx ON audit.log USING btree (relid);


--
-- Name: country_grid_110km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_110km_centroid_location_index ON public.country_grid_110km USING gist (centroid_location);


--
-- Name: country_grid_110km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_110km_geom_index ON public.country_grid_110km USING gist (geom);


--
-- Name: country_grid_11km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_11km_centroid_location_index ON public.country_grid_11km USING gist (centroid_location);


--
-- Name: country_grid_11km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_11km_geom_index ON public.country_grid_11km USING gist (geom);


--
-- Name: country_grid_220km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_220km_centroid_location_index ON public.country_grid_220km USING gist (centroid_location);


--
-- Name: country_grid_220km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_220km_geom_index ON public.country_grid_220km USING gist (geom);


--
-- Name: country_grid_22km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_22km_centroid_location_index ON public.country_grid_22km USING gist (centroid_location);


--
-- Name: country_grid_22km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_22km_geom_index ON public.country_grid_22km USING gist (geom);


--
-- Name: country_grid_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_55km_centroid_location_index ON public.country_grid_55km USING gist (centroid_location);


--
-- Name: country_grid_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_55km_geom_index ON public.country_grid_55km USING gist (geom);


--
-- Name: postal_codes_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_location_index ON public.postal_codes USING gist (location);


--
-- Name: postal_codes_postal_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_postal_code_index ON public.postal_codes USING btree (postal_code);


--
-- Name: state_grid_110km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_110km_centroid_location_index ON public.state_grid_110km USING gist (centroid_location);


--
-- Name: state_grid_110km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_110km_geom_index ON public.state_grid_110km USING gist (geom);


--
-- Name: state_grid_11km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_11km_centroid_location_index ON public.state_grid_11km USING gist (centroid_location);


--
-- Name: state_grid_11km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_11km_geom_index ON public.state_grid_11km USING gist (geom);


--
-- Name: state_grid_220km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_220km_centroid_location_index ON public.state_grid_220km USING gist (centroid_location);


--
-- Name: state_grid_220km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_220km_geom_index ON public.state_grid_220km USING gist (geom);


--
-- Name: state_grid_22km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_22km_centroid_location_index ON public.state_grid_22km USING gist (centroid_location);


--
-- Name: state_grid_22km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_22km_geom_index ON public.state_grid_22km USING gist (geom);


--
-- Name: state_grid_500k_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_500k_55km_centroid_location_index ON public.state_grid_500k_55km USING gist (centroid_location);


--
-- Name: state_grid_500k_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_500k_55km_geom_index ON public.state_grid_500k_55km USING gist (geom);


--
-- Name: state_grid_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_55km_centroid_location_index ON public.state_grid_55km USING gist (centroid_location);


--
-- Name: state_grid_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_55km_geom_index ON public.state_grid_55km USING gist (geom);


--
-- Name: states_boundaries_500k_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_500k_index ON public.states USING gist (boundaries_500k);


--
-- Name: states_boundaries_5m_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_5m_index ON public.states USING gist (boundaries_5m);


--
-- Name: states_boundaries_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_index ON public.states USING gist (boundaries);


--
-- Name: stores_appointments_available_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_appointments_available_index ON public.stores USING btree (appointments_available);


--
-- Name: stores_appointments_last_fetched_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_appointments_last_fetched_index ON public.stores USING btree (appointments_last_fetched);


--
-- Name: stores_carries_vaccine_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_carries_vaccine_index ON public.stores USING btree (carries_vaccine);


--
-- Name: stores_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_location_index ON public.stores USING gist (location);


--
-- Name: stores_state_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_state_index ON public.stores USING btree (state);


--
-- Name: walgreens_grid_centroid_land_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_centroid_land_location_index ON public.walgreens_grid USING gist (centroid_land_location);


--
-- Name: walgreens_grid_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_centroid_location_index ON public.walgreens_grid USING gist (centroid_location);


--
-- Name: walgreens_grid_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_geom_index ON public.walgreens_grid USING gist (geom);


--
-- Name: stores audit_trigger_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger_row AFTER INSERT OR DELETE OR UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func('false', '{created_at,updated_at,metadata_raw,appointments_raw,appointments_last_fetched}');


--
-- Name: stores audit_trigger_stm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger_stm AFTER TRUNCATE ON public.stores FOR EACH STATEMENT EXECUTE FUNCTION audit.if_modified_func('false');


--
-- Name: postal_codes postal_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER postal_codes_updated_at BEFORE UPDATE ON public.postal_codes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: states states_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER states_updated_at BEFORE UPDATE ON public.states FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: stores stores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: postal_codes postal_codes_state_code_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_state_code_foreign FOREIGN KEY (state_code) REFERENCES public.states(code);


--
-- Name: provider_brands provider_brands_provider_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: stores stores_postal_code_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_postal_code_foreign FOREIGN KEY (postal_code) REFERENCES public.postal_codes(postal_code);


--
-- Name: stores stores_provider_brand_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_brand_id_foreign FOREIGN KEY (provider_brand_id) REFERENCES public.provider_brands(id);


--
-- Name: stores stores_provider_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: stores stores_state_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_state_foreign FOREIGN KEY (state) REFERENCES public.states(code);


--
-- PostgreSQL database dump complete
--



--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1
-- Dumped by pg_dump version 13.2 (Debian 13.2-1.pgdg100+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: knex_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knex_migrations (id, name, batch, migration_time) FROM stdin;
1	20210221100547_create_states.js	1	2021-04-11 22:26:45.795+00
2	20210221100553_create_postal_codes.js	1	2021-04-11 22:26:45.825+00
3	20210221143355_create_stores.js	1	2021-04-11 22:26:45.87+00
4	20210222161552_optional_store_location.js	1	2021-04-11 22:26:45.872+00
5	20210223095007_state_boundaries.js	1	2021-04-11 22:26:46.245+00
6	20210223173502_store_time_zone.js	1	2021-04-11 22:26:46.246+00
7	20210223232431_optional_store_city_state.js	1	2021-04-11 22:26:46.249+00
8	20210225081423_country_grids.js	1	2021-04-11 22:26:47.97+00
9	20210226081756_audit.js	1	2021-04-11 22:26:48.009+00
10	20210227104231_postal_code_time_zone.js	1	2021-04-11 22:26:48.01+00
11	20210301091717_smaller_country_grids.js	1	2021-04-11 22:26:49.709+00
12	20210302161153_bigger_country_grid.js	1	2021-04-11 22:26:50.563+00
13	20210304151335_provider_brand.js	1	2021-04-11 22:26:50.606+00
14	20210307114320_geocoding.js	1	2021-04-11 22:26:50.615+00
15	20210307171239_store_url.js	1	2021-04-11 22:26:50.615+00
16	20210315165140_store_normalized_address_key.js	1	2021-04-11 22:26:50.631+00
17	20210322161258_walgreens_grid.js	1	2021-04-11 22:26:50.647+00
18	20210324142039_store_vaccine_appointment_types.js	1	2021-04-11 22:26:50.648+00
19	20210325091544_create_cache.js	1	2021-04-11 22:26:50.662+00
20	20210329150722_states_boundaries_500k.js	1	2021-04-11 22:26:50.664+00
21	20210329160409_create_state_grid_55km_500k.js	1	2021-04-11 22:26:51.185+00
22	20210401101728_appointments_last_modified.js	1	2021-04-11 22:26:51.186+00
23	20210408224048_convert_materialized_views.js	1	2021-04-11 22:26:51.404+00
24	20210409102212_audit_index.js	1	2021-04-11 22:26:51.411+00
\.


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.knex_migrations_id_seq', 24, true);


--
-- PostgreSQL database dump complete
--
